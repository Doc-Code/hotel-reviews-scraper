const puppeteer = require("puppeteer");

async function scrapeGoogleMapsReviews(url) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle0" });

    // Нажать на секцию отзывов для их загрузки
    await page.click('button[jsaction="pane.rating.moreReviews"]');
    await page.waitForTimeout(2000);

    // Прокрутка для загрузки большего количества отзывов
    const reviewsContainer = ".section-layout.section-scrollbox";
    await autoScroll(page, reviewsContainer);

    // Собрать отзывы
    const reviews = await page.evaluate(() => {
      const reviewElements = document.querySelectorAll(
        ".section-review-content"
      );
      return Array.from(reviewElements).map((review) => {
        const authorElement = review.querySelector(".section-review-title");
        const ratingElement = review.querySelector(".section-review-stars");
        const textElement = review.querySelector(".section-review-text");
        const dateElement = review.querySelector(
          ".section-review-publish-date"
        );

        return {
          author: authorElement ? authorElement.textContent.trim() : "",
          rating: ratingElement
            ? parseInt(ratingElement.getAttribute("aria-label"))
            : 0,
          text: textElement ? textElement.textContent.trim() : "",
          date: dateElement ? dateElement.textContent.trim() : "",
          source: "Google Maps",
        };
      });
    });

    return reviews;
  } catch (error) {
    console.error("Error scraping Google Maps reviews:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function autoScroll(page, selector) {
  await page.evaluate(async (selector) => {
    const container = document.querySelector(selector);
    if (!container) return;

    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = container.scrollHeight;
        container.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  }, selector);
}

module.exports = { scrapeGoogleMapsReviews };
