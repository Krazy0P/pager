import Link from "next/link";
import { PagerMark } from "@/components/pager-mark";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex h-14 items-center px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <PagerMark />
          <span className="text-[15px] font-semibold tracking-tight">Pager</span>
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-20 pt-6">
        {children}
      </div>
    </main>
  );
}
