import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span>Party-up</span>
        <nav className="flex items-center gap-4">
          <Link href="/about" className="hover:text-foreground">
            Party-up이란?
          </Link>
          <Link href="/support" className="hover:text-foreground">
            고객지원
          </Link>
        </nav>
      </div>
    </footer>
  );
}
