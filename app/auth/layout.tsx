import Link from "next/link";
import Image from "next/image";
import { MessageCircleDashed } from "lucide-react";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="relative h-svh flex flex-col gap-4">
        <div className="absolute flex justify-center gap-2 pt-10 pl-10 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <MessageCircleDashed className="size-4" />
            </div>
            Pager
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center max-h-svh">
          {children}
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block max-h-svh">
        <Image
          src="/images/background.png"
          alt="Image"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          fill
          priority
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </main>
  );
}
