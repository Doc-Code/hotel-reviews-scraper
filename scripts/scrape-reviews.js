const { BookingReviewsScraper } = require("../scrapers/booking-apify");
require("dotenv").config();

async function runScraper() {
  // Проверяем наличие токена
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    console.error("Ошибка: Не указан APIFY_TOKEN в переменных окружения");
    process.exit(1);
  }

  const hotelUrls = [
    // Здесь укажите URLs отелей, которые хотите обработать
  ];

  if (hotelUrls.length === 0) {
    console.error("Ошибка: Добавьте URLs отелей в массив hotelUrls");
    process.exit(1);
  }

  const scraper = new BookingReviewsScraper(apifyToken);

  try {
    console.log(`Начинаем сбор отзывов для ${hotelUrls.length} отелей...`);
    const reviews = await scraper.scrapeHotelReviews(hotelUrls);

    // Сохраняем результаты в CSV
    const outputPath = `booking_reviews_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    await scraper.saveReviewsToCsv(reviews, outputPath);

    console.log("Сбор отзывов завершен успешно!");
    console.log(`Всего собрано отзывов: ${reviews.length}`);
    console.log(`Результаты сохранены в файл: ${outputPath}`);
  } catch (error) {
    console.error("Произошла ошибка при сборе отзывов:", error);
    process.exit(1);
  }
}

runScraper();
