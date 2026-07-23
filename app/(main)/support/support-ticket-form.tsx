"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Paperclip } from "lucide-react";
import {
  SUPPORT_TICKET_TYPE_LABEL,
  SUPPORT_ATTACHMENT_ACCEPT,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_MAX_FILES,
  type SupportTicketType,
} from "@/lib/supabase/types";

const TICKET_TYPES = Object.keys(SUPPORT_TICKET_TYPE_LABEL) as SupportTicketType[];
const ALLOWED_MIME = new Set(SUPPORT_ATTACHMENT_ACCEPT.split(","));

export function SupportTicketForm({
  userId,
  initialEmail,
}: {
  userId: string | null;
  initialEmail: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ticketType, setTicketType] = useState<SupportTicketType | "">("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ticketNumber: number } | null>(null);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;

    const next = [...files];
    for (const file of picked) {
      if (next.length >= SUPPORT_ATTACHMENT_MAX_FILES) {
        toast.error(`첨부파일은 최대 ${SUPPORT_ATTACHMENT_MAX_FILES}개까지 가능해요.`);
        break;
      }
      if (!ALLOWED_MIME.has(file.type)) {
        toast.error(`${file.name}: jpg, png, gif, pdf 파일만 첨부할 수 있어요.`);
        continue;
      }
      if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
        toast.error(`${file.name}: 10MB 이하 파일만 첨부할 수 있어요.`);
        continue;
      }
      next.push(file);
    }
    setFiles(next);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketType) {
      toast.error("문의 유형을 선택해주세요.");
      return;
    }
    if (!subject.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      toast.error("내용을 입력해주세요.");
      return;
    }
    if (!email.trim()) {
      toast.error("이메일을 입력해주세요.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const ticketId = crypto.randomUUID();

    const { error: ticketError } = await supabase.from("support_tickets").insert({
      id: ticketId,
      user_id: userId,
      email: email.trim(),
      ticket_type: ticketType,
      subject: subject.trim(),
      content: content.trim(),
    });

    if (ticketError) {
      setLoading(false);
      toast.error("문의 접수에 실패했어요: " + ticketError.message);
      return;
    }

    for (const file of files) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("support-attachments")
        .upload(path, file);
      if (uploadError) {
        toast.error(`${file.name} 첨부 실패: ` + uploadError.message);
        continue;
      }
      await supabase.from("support_attachments").insert({
        ticket_id: ticketId,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      });
    }

    fetch("/api/support/notify-new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId }),
    }).catch(() => {});

    setLoading(false);

    const { data: created } = await supabase
      .from("support_tickets")
      .select("ticket_number")
      .eq("id", ticketId)
      .maybeSingle();

    setResult({ ticketNumber: created?.ticket_number ?? 0 });
    router.refresh();
  }

  if (result) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6 text-center">
          <p className="text-lg font-semibold">문의가 접수됐어요</p>
          <p className="text-sm text-muted-foreground">
            문의번호 #{result.ticketNumber} · 운영진이 확인 후 이메일로 답변드릴게요.
          </p>
          {userId ? (
            <Button nativeButton={false} render={<Link href="/my/support" />}>
              내 문의 내역에서 확인하기
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              로그인하면 언제든 처리 현황을 확인할 수 있어요.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>문의 유형</Label>
        <Select
          value={ticketType}
          onValueChange={(value) => setTicketType((value as SupportTicketType) ?? "")}
          items={SUPPORT_TICKET_TYPE_LABEL}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="유형을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {TICKET_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {SUPPORT_TICKET_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">제목</Label>
        <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} required />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="content">내용</Label>
          <span className="text-xs text-muted-foreground">{content.length}/3000</span>
        </div>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 3000))}
          maxLength={3000}
          rows={6}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">답변은 이 이메일로 발송돼요.</p>
      </div>

      <div className="space-y-2">
        <Label>첨부파일 (선택)</Label>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SUPPORT_ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={handleFilesSelected}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="size-4" />
          파일 추가
        </Button>
        <p className="text-xs text-muted-foreground">jpg, png, gif, pdf · 최대 10MB · 최대 5개</p>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm"
              >
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="첨부 제거"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "접수 중..." : "문의 보내기"}
      </Button>
    </form>
  );
}
