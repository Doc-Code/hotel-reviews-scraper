const { BookingReviewsScraper } = require("./booking-apify");
require("dotenv").config();

function isValidBookingUrl(url) {
  try {
    const urlObj = new URL(url);
    // Проверяем, что это действительно URL booking.com
    if (!urlObj.hostname.includes("booking.com")) {
      return false;
    }

    // Проверяем, что это URL отеля (должен содержать /hotel/ в пути)
    if (!urlObj.pathname.includes("/hotel/")) {
      return false;
    }

    return true;
  } catch (error) {
    // Если URL невалидный, вернется false
    return false;
  }
}

async function scrapeBookingReviews(url) {
  try {
    // Проверяем валидность URL перед скрапингом
    if (!isValidBookingUrl(url)) {
      throw new Error(
        "Неверная ссылка. Пожалуйста, предоставьте корректную ссылку на отель Booking.com"
      );
    }

    const apifyToken = process.env.APIFY_TOKEN;
    if (!apifyToken) {
      throw new Error("APIFY_TOKEN не настроен в переменных окружения");
    }

    const scraper = new BookingReviewsScraper(apifyToken);
    const reviews = await scraper.scrapeHotelReviews([url]);

    return reviews;
  } catch (error) {
    console.error("Ошибка при скрапинге Booking.com:", error);
    throw error;
  }
}

module.exports = { scrapeBookingReviews, isValidBookingUrl };
