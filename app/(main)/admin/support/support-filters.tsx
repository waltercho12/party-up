"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORT_TICKET_TYPE_LABEL, SUPPORT_TICKET_STATUS_LABEL } from "@/lib/supabase/types";

const PERIOD_LABEL: Record<string, string> = {
  all: "전체 기간",
  today: "오늘",
  "7d": "최근 7일",
  "30d": "최근 30일",
};

export function SupportFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/admin/support?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParam("q", q.trim() || null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목, 작성자, 내용 검색"
          className="w-56"
        />
        <Button type="submit" variant="outline" size="sm">
          검색
        </Button>
      </form>

      <Select
        defaultValue={searchParams.get("status") ?? "all"}
        onValueChange={(value) => updateParam("status", value)}
        items={{ all: "전체 상태", ...SUPPORT_TICKET_STATUS_LABEL }}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="상태" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 상태</SelectItem>
          {Object.entries(SUPPORT_TICKET_STATUS_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("type") ?? "all"}
        onValueChange={(value) => updateParam("type", value)}
        items={{ all: "전체 유형", ...SUPPORT_TICKET_TYPE_LABEL }}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 유형</SelectItem>
          {Object.entries(SUPPORT_TICKET_TYPE_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("period") ?? "all"}
        onValueChange={(value) => updateParam("period", value)}
        items={PERIOD_LABEL}
      >
        <SelectTrigger className="w-28">
          <SelectValue placeholder="기간" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PERIOD_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("sort") ?? "newest"}
        onValueChange={(value) => updateParam("sort", value)}
        items={{ newest: "최신순", oldest: "오래된순" }}
      >
        <SelectTrigger className="w-28">
          <SelectValue placeholder="정렬" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">최신순</SelectItem>
          <SelectItem value="oldest">오래된순</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
