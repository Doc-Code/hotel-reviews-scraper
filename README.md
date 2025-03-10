# Hotel Reviews Scraper Bot

Telegram бот для сбора отзывов с Google Maps и Booking.com.

## Установка

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd hotel-reviews-scraper
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

4. Отредактируйте `.env` файл и добавьте ваш Telegram Bot Token:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

## Использование

1. Запустите бот:
```bash
npm start
```

2. В Telegram найдите вашего бота и отправьте команду `/start`

3. Выберите источник отзывов (Google Maps или Booking.com)

4. Отправьте ссылку на место/отель

5. Бот соберет отзывы и отправит их в формате CSV

6. Для импорта данных в Google Sheets обратитесь к @drcode или @YazzzzzvA

## Требования

- Node.js 14+
- NPM 6+
- Доступ к интернету
- Telegram Bot Token (получить можно у @BotFather) 