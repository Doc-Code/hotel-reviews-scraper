const { ApifyClient } = require("apify-client");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const path = require("path");

class BookingReviewsScraper {
  constructor(apifyToken) {
    this.client = new ApifyClient({
      token: apifyToken,
    });
  }

  async scrapeHotelReviews(hotelUrls, maxReviewsPerHotel = 100) {
    console.log("Начинаем сбор отзывов...");
    const allReviews = [];

    for (const [index, url] of hotelUrls.entries()) {
      console.log(
        `Обрабатываем отель ${index + 1}/${hotelUrls.length}: ${url}`
      );

      try {
        const reviews = await this.scrapeReviewsForHotel(
          url,
          maxReviewsPerHotel
        );
        allReviews.push(...reviews);
        console.log(`Получено ${reviews.length} отзывов для отеля`);
      } catch (error) {
        console.error(`Ошибка при сборе отзывов для ${url}:`, error.message);
      }

      // Небольшая пауза между запросами
      if (index < hotelUrls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return allReviews;
  }

  async scrapeReviewsForHotel(hotelUrl, maxReviews) {
    const run = await this.client
      .actor("voyager/booking-reviews-scraper")
      .call({
        startUrls: [{ url: hotelUrl }],
        maxReviews: maxReviews,
        language: "en-us",
        proxyConfiguration: {
          useApifyProxy: true,
        },
      });

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    return items.map((review) => ({
      userName: review.userName || "",
      userLocation: review.userLocation || "",
      rating: review.rating || 0,
      reviewDate: review.reviewDate || "",
      checkInDate: review.checkInDate || "",
      checkOutDate: review.checkOutDate || "",
      likedText: review.likedText || "",
      dislikedText: review.dislikedText || "",
      reviewTitle: review.reviewTitle || "",
      travelerType: review.travelerType || "",
      roomInfo: review.roomInfo || "",
      numberOfNights: review.numberOfNights || 0,
      propertyResponse: review.propertyResponse || "",
      hotelRatingScores: review.hotelRatingScores || [],
      helpfulVotes: review.helpfulVotes || 0,
      reviewLanguage: review.reviewLanguage || "",
      hotelId: review.hotelId || "",
      images: review.images || [],
    }));
  }

  async saveReviewsToCsv(reviews, outputPath = "booking_reviews.csv") {
    const csvWriter = createCsvWriter({
      path: outputPath,
      header: [
        { id: "userName", title: "Имя пользователя" },
        { id: "userLocation", title: "Местоположение" },
        { id: "rating", title: "Оценка" },
        { id: "reviewDate", title: "Дата отзыва" },
        { id: "checkInDate", title: "Дата заезда" },
        { id: "checkOutDate", title: "Дата выезда" },
        { id: "likedText", title: "Положительные впечатления" },
        { id: "dislikedText", title: "Отрицательные впечатления" },
        { id: "reviewTitle", title: "Заголовок отзыва" },
        { id: "travelerType", title: "Тип путешественника" },
        { id: "roomInfo", title: "Информация о номере" },
        { id: "numberOfNights", title: "Количество ночей" },
        { id: "propertyResponse", title: "Ответ отеля" },
        { id: "helpfulVotes", title: "Полезные голоса" },
        { id: "reviewLanguage", title: "Язык отзыва" },
      ],
    });

    try {
      await csvWriter.writeRecords(reviews);
      console.log(`Отзывы успешно сохранены в ${outputPath}`);
    } catch (error) {
      console.error("Ошибка при сохранении в CSV:", error);
      throw error;
    }
  }
}

// Пример использования:
async function main() {
  // Замените на ваш токен Apify
  const scraper = new BookingReviewsScraper("your_apify_token");

  const hotelUrls = [
    "https://www.booking.com/hotel/example1",
    "https://www.booking.com/hotel/example2",
  ];

  try {
    const reviews = await scraper.scrapeHotelReviews(hotelUrls, 100);
    await scraper.saveReviewsToCsv(reviews);
  } catch (error) {
    console.error("Произошла ошибка:", error);
  }
}

module.exports = { BookingReviewsScraper };
