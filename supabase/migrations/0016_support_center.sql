-- Party-up MVP schema — round 9 (Support Center)
--
-- Five separate entities (tickets / attachments / replies / history /
-- feedback), all TEXT+CHECK instead of hard enums so ticket_type/status can
-- grow later (tags, priority, AI auto-reply routing, etc.) without an
-- ALTER TYPE ceremony. History rows are only ever written by triggers
-- (SECURITY DEFINER, same pattern as reputation_tiers/notifications) so a
-- client can never forge or edit its own timeline. internal_note stays a
-- plain column on support_tickets, but — like manner_evaluations.comment —
-- it is never selected by any user-facing query in the app; only the admin
-- pages fetch it.

-- ============================================================
-- 1. Tables
-- ============================================================

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ticket_type text not null check (ticket_type in (
    'question', 'bug', 'feature_request', 'compliment',
    'complaint', 'report_related', 'account_issue', 'other'
  )),
  subject text not null check (char_length(subject) between 1 and 200),
  content text not null check (char_length(content) between 1 and 3000),
  status text not null default 'open' check (status in (
    'open', 'in_review', 'in_progress', 'resolved', 'closed'
  )),
  assignee_id uuid references public.profiles(id) on delete set null,
  internal_note text check (char_length(internal_note) <= 3000),
  admin_notified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_support_tickets_user_id on public.support_tickets(user_id);
create index idx_support_tickets_status on public.support_tickets(status);
create index idx_support_tickets_created_at on public.support_tickets(created_at desc);

create table public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_size int not null check (file_size > 0 and file_size <= 10 * 1024 * 1024),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/gif', 'application/pdf')),
  created_at timestamptz not null default now()
);

create index idx_support_attachments_ticket_id on public.support_attachments(ticket_id);

create table public.support_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_support_replies_ticket_id on public.support_replies(ticket_id);

create table public.support_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_support_history_ticket_id on public.support_history(ticket_id);

create table public.support_feedback (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.support_tickets(id) on delete cascade,
  helpful boolean not null,
  comment text check (char_length(comment) <= 300),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. Notifications: link a notification back to a support ticket too,
--    same table used for party events.
-- ============================================================

alter table public.notifications
  add column support_ticket_id uuid references public.support_tickets(id) on delete cascade;

-- ============================================================
-- 3. RLS
-- ============================================================

alter table public.support_tickets enable row level security;
alter table public.support_attachments enable row level security;
alter table public.support_replies enable row level security;
alter table public.support_history enable row level security;
alter table public.support_feedback enable row level security;

-- Anyone (including anon/guest) can file a ticket; the row must claim
-- either no owner, or the actual signed-in caller — never someone else.
create policy "support_tickets_insert" on public.support_tickets
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create policy "support_tickets_select" on public.support_tickets
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Only admins change status/assignee/internal_note; nothing else is
-- editable after submission (no self-service ticket edits).
create policy "support_tickets_update_admin" on public.support_tickets
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "support_attachments_insert" on public.support_attachments
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.support_tickets t where t.id = ticket_id)
  );

create policy "support_attachments_select" on public.support_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "support_replies_insert_admin" on public.support_replies
  for insert to authenticated
  with check (public.is_admin() and author_id = auth.uid());

create policy "support_replies_select" on public.support_replies
  for select to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin())
    )
  );

-- No insert policy at all on support_history — only the SECURITY DEFINER
-- triggers below ever write to it.
create policy "support_history_select" on public.support_history
  for select to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "support_feedback_insert_own" on public.support_feedback
  for insert to authenticated
  with check (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid() and t.status = 'resolved'
    )
  );

create policy "support_feedback_select" on public.support_feedback
  for select to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin())
    )
  );

-- ============================================================
-- 4. Rate limiting — at most 3 tickets per email per 5 minutes. Enforced
--    in the database so it holds regardless of which client hits it.
-- ============================================================

create or replace function public.enforce_support_ticket_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.support_tickets
  where email = new.email and created_at > now() - interval '5 minutes';

  if recent_count >= 3 then
    raise exception 'Too many support tickets submitted recently. Please try again later.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger trg_support_ticket_rate_limit
before insert on public.support_tickets
for each row execute function public.enforce_support_ticket_rate_limit();

-- ============================================================
-- 5. Timeline automation
-- ============================================================

create or replace function public.log_support_ticket_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_history (ticket_id, actor_id, event_type, description)
  values (new.id, new.user_id, 'created', '문의 접수');
  return new;
end;
$$;

create trigger trg_support_ticket_created
after insert on public.support_tickets
for each row execute function public.log_support_ticket_created();

create or replace function public.log_support_ticket_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_label text;
begin
  if new.status = old.status then
    return new;
  end if;

  status_label := case new.status
    when 'in_review' then '검토 중으로 변경'
    when 'in_progress' then '개발팀 확인 중으로 변경'
    when 'resolved' then '해결 완료로 변경'
    when 'closed' then '문의 종료'
    else '접수 완료로 변경'
  end;

  insert into public.support_history (ticket_id, actor_id, event_type, description, metadata)
  values (
    new.id, auth.uid(), 'status_changed', status_label,
    jsonb_build_object('from', old.status, 'to', new.status)
  );
  return new;
end;
$$;

create trigger trg_support_ticket_status_change
after update on public.support_tickets
for each row execute function public.log_support_ticket_status_change();

create or replace function public.log_support_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_owner uuid;
begin
  insert into public.support_history (ticket_id, actor_id, event_type, description)
  values (new.ticket_id, new.author_id, 'reply_added', '답변 발송');

  select user_id into ticket_owner from public.support_tickets where id = new.ticket_id;
  if ticket_owner is not null then
    insert into public.notifications (user_id, type, support_ticket_id, actor_id)
    values (ticket_owner, 'support_reply', new.ticket_id, new.author_id);
  end if;

  return new;
end;
$$;

create trigger trg_support_reply_created
after insert on public.support_replies
for each row execute function public.log_support_reply();

create or replace function public.log_support_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_history (ticket_id, event_type, description)
  values (new.ticket_id, 'feedback_submitted', '사용자 만족도 평가 완료');
  return new;
end;
$$;

create trigger trg_support_feedback_created
after insert on public.support_feedback
for each row execute function public.log_support_feedback();

create or replace function public.touch_support_ticket_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_support_ticket_touch_updated_at
before update on public.support_tickets
for each row execute function public.touch_support_ticket_updated_at();

-- ============================================================
-- 6. Storage: attachment bucket. Guests must be able to upload too, so
--    insert is broad (bucket-scoped only); select is gated to the ticket
--    owner or an admin via the same ticket-ownership check used above,
--    keyed off the {ticket_id}/... path Layout the client uploads to.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;

create policy "support_attachments_storage_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'support-attachments');

create policy "support_attachments_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and exists (
      select 1 from public.support_tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (t.user_id = auth.uid() or public.is_admin())
    )
  );
