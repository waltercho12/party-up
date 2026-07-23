insert into public.admins (user_id)
select id from public.profiles where id = (
  select id from auth.users where email = 'waltercho12@gmail.com'
)
on conflict (user_id) do nothing;
