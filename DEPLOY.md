# Розгортання на Railway (найпростіший варіант)

Railway хостить сайт і бота як **один сервіс** в одному контейнері (`npm run start` запускає
обидва процеси одночасно) — так вони гарантовано ділять один і той самий файл бази `tyaga.db`
на одному диску. Це найпростіший спосіб отримати робочий сайт + бота онлайн без власного сервера.

**Вартість**: 30 днів пробного періоду з $5 кредиту (карта не потрібна), далі тариф Hobby —
від $5/міс, включає постійний диск до 5 ГБ (нашій SQLite-базі цього вистачить з великим
запасом). Актуальні ціни: https://railway.com/pricing

## Крок 1. Викласти код на GitHub

Якщо ще не маєте акаунту на [github.com](https://github.com) — зареєструйтесь (безкоштовно).
Створіть новий репозиторій (наприклад `tyaga-pyriatyn`), нічого в ньому не ініціалізуючи
(без README/gitignore — вони вже є в проєкті).

У теці проєкту:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<ваш-акаунт>/tyaga-pyriatyn.git
git push -u origin main
```

## Крок 2. Створити проєкт на Railway

1. Зареєструйтесь на [railway.com](https://railway.com) (можна через GitHub).
2. **New Project → Deploy from GitHub repo** → оберіть щойно створений репозиторій.
3. Railway сам розпізнає `railway.json` у корені й використає команди звідти
   (`npm install && npm run build` для збірки, `npm run start` для запуску).

## Крок 3. Додати постійний диск (Volume)

Без цього дані (брони, замовлення) губитимуться при кожному передеплої.

1. Відкрийте сервіс → вкладка **Settings → Volumes → New Volume**.
2. Mount path: `/data`
3. Збережіть.

## Крок 4. Змінні середовища

Settings → Variables, додайте:

| Змінна | Значення |
|---|---|
| `DATABASE_FILE` | `/data/tyaga.db` |
| `TELEGRAM_BOT_TOKEN` | токен від [@BotFather](https://t.me/BotFather) (`/newbot`) |
| `TELEGRAM_ADMIN_CHAT_ID` | (опційно) id чату для сповіщень про нові брони/замовлення |
| `WEBAPP_URL` | поки що залиште порожнім — заповните на кроці 6 |
| `NODE_ENV` | `production` |

## Крок 5. Дочекатись деплою

Railway автоматично збере й запустить проєкт. У вкладці **Deployments** можна дивитись логи —
там має з'явитись `Seeding 92 flavors...` → `Tyaga Pyriatyn bot is running.` та `Ready` від
Next.js.

## Крок 6. Отримати домен і підключити бота до сайту

1. Settings → **Networking → Generate Domain** — отримаєте адресу типу
   `https://tyaga-pyriatyn-production.up.railway.app`.
2. Поверніться до Variables, впишіть цю адресу в `WEBAPP_URL` (без `/` на кінці).
3. Це викличе автоматичний редеплой. Тепер кнопки бота «Забронювати столик» і «Забивка на
   самовивіз» відкриватимуть саме сторінки сайту прямо в Telegram.

Пізніше можна підключити власний домен (наприклад `tyaga-pyriatyn.com.ua`) через
**Settings → Networking → Custom Domain** — Railway покаже, які DNS-записи додати у вашого
реєстратора домену.

## Крок 7. Перевірити бота

Відкрийте бота в Telegram за посиланням `t.me/<username_бота>`, натисніть **Start**. Спробуйте
пройти бронювання столика й замовлення забивки — вони мають з'явитися в базі (переглянути можна
через `railway run npm run db:studio`, якщо встановити Railway CLI, або тимчасово через
Deployments → Shell).

## Оновлення проєкту надалі

Будь-який `git push` у гілку `main` автоматично запускає новий деплой на Railway. Схема бази
(`packages/db/src/schema.ts`) і смаки (`packages/db/src/flavors.json`) синхронізуються при
кожному старті (`npm run db:push && npm run db:seed`) — це безпечно, дублікатів не буде,
існуючі брони/замовлення не зачіпаються.
