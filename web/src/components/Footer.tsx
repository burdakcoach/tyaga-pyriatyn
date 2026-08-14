import { INSTAGRAM_URL, SITE_CITY, TELEGRAM_BOT_URL, WORKING_HOURS } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-brass/20 bg-panel">
      <div className="h-[3px] brass-rule" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-3 text-sm text-muted">
        <div>
          <p className="text-foreground font-bold text-lg mb-2">Tyaga Pyriatyn</p>
          <p>Кальян-лаунж у {SITE_CITY}і.</p>
          <p className="mt-2">{WORKING_HOURS}</p>
        </div>
        <div>
          <p className="text-foreground font-semibold mb-2">Контакти</p>
          <a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer" className="block hover:text-brass">
            Telegram-бот
          </a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="block hover:text-brass mt-1">
            Instagram
          </a>
        </div>
        <div>
          <p className="text-foreground font-semibold mb-2">Швидкі посилання</p>
          <a href="/menu" className="block hover:text-brass">
            Каталог смаків
          </a>
          <a href="/booking" className="block hover:text-brass mt-1">
            Забронювати столик
          </a>
          <a href="/order" className="block hover:text-brass mt-1">
            Замовити забивку на виніс
          </a>
        </div>
      </div>
      <div className="text-center text-xs text-muted/70 pb-6">
        © {new Date().getFullYear()} Tyaga Pyriatyn
      </div>
    </footer>
  );
}
