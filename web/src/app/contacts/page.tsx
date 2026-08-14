import { INSTAGRAM_URL, SITE_CITY, TELEGRAM_BOT_URL, WORKING_HOURS } from "@/lib/constants";

export default function ContactsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
      <h1 className="text-3xl font-extrabold mb-8">Контакти</h1>
      <div className="rounded-2xl border border-brass/20 bg-panel p-8 space-y-4">
        <div>
          <p className="text-muted text-sm">Місто</p>
          <p className="font-medium">{SITE_CITY}</p>
          {/* TODO: додати точну адресу закладу */}
        </div>
        <div>
          <p className="text-muted text-sm">Графік роботи</p>
          <p className="font-medium">{WORKING_HOURS}</p>
        </div>
        <div>
          <p className="text-muted text-sm">Telegram-бот</p>
          <a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer" className="font-medium text-brass hover:underline">
            {TELEGRAM_BOT_URL}
          </a>
        </div>
        <div>
          <p className="text-muted text-sm">Instagram</p>
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="font-medium text-brass hover:underline">
            instagram.com/tyaga.pyriatin
          </a>
        </div>
      </div>
    </div>
  );
}
