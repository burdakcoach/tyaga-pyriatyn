import Image from "next/image";
import Link from "next/link";
import { TELEGRAM_BOT_URL } from "@/lib/constants";

const NAV = [
  { href: "/menu", label: "Смаки" },
  { href: "/booking", label: "Столики" },
  { href: "/order", label: "Забивка на виніс" },
  { href: "/contacts", label: "Контакти" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-brass/20">
      <div className="h-[3px] brass-rule" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="Tyaga" width={40} height={36} className="h-9 w-auto" priority />
          <span className="hidden xs:inline text-xl font-extrabold tracking-wide text-foreground">
            Tyaga <span className="text-emerald-light">Pyriatyn</span>
          </span>
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted hover:text-brass transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <a
          href={TELEGRAM_BOT_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-emerald hover:bg-emerald-light transition-colors text-sm font-semibold px-4 py-2 shrink-0"
        >
          Відкрити бот
        </a>
      </div>
      <nav className="sm:hidden flex items-center gap-4 px-4 pb-3 text-sm overflow-x-auto scrollbar-thin">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="text-muted hover:text-brass whitespace-nowrap">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
