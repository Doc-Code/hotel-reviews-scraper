"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeBookingService = void 0;
const apify_1 = require("../utils/apify");
const puppeteer_1 = require("../utils/puppeteer");
const scrapeBookingService = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (numHotels = 5) {
    let browser;
    try {
        browser = yield (0, puppeteer_1.initBrowser)();
        const page = yield browser.newPage();
        page.setDefaultNavigationTimeout(2 * 60 * 1000);
        const url = "https://www.booking.com/searchresults.html?ss=Ghana";
        yield page.goto(url);
        console.log("Navigated to search results page. Extracting hotel links...");
        const hotelLinks = yield page.evaluate(() => {
            const hotelAnchors = Array.from(document.querySelectorAll('a[data-testid="title-link"]'));
            console.log(hotelAnchors);
            return hotelAnchors.map((anchor) => {
                const titleDiv = anchor.querySelector('div[data-testid="title"]');
                return {
                    name: titleDiv ? titleDiv.textContent : "Unknown Hotel",
                    url: anchor.href,
                };
            });
        });
        console.log(`Found ${hotelLinks.length} hotel links. Scraping reviews...`);
        const allReviews = [];
        for (const link of hotelLinks.slice(0, numHotels)) {
            console.log(`Scraping reviews for ${link.name}`);
            yield new Promise((resolve) => setTimeout(resolve, 2000)); // 2-second delay
            const items = yield (0, apify_1.runApifyActor)("voyager/booking-reviews-scraper", {
                startUrls: [{ url: link.url }],
                maxReviews: 100,
                language: "en-us",
            });
            const hotelReviews = items.map((item) => ({
                hotel: item.hotelId,
                rating: item.rating,
                date: item.reviewDate,
                stayDuration: item.stayDuration,
                content: Object.values(item.reviewTextParts).join(" "),
                reviewer: item.reviewer,
                // userName: item.userName,
                // userLocation: item.userLocation,
                // stayDate: item.stayDate,
                // travelerType: item.travelerType,
                // roomInfo: item.roomInfo,
            }));
            allReviews.push(...hotelReviews);
            allReviews.push(...hotelReviews);
        }
        // if (allReviews.length > 0) {
        //   await saveToCSV(allReviews, "booking_reviews.csv", [
        //     { id: "hotel", title: "Hotel" },
        //     { id: "rating", title: "Rating" },
        //     { id: "date", title: "Review Date" },
        //     { id: "content", title: "Content" },
        //     { id: "userName", title: "User Name" },
        //     { id: "userLocation", title: "User Location" },
        //     { id: "stayDate", title: "Stay Date" },
        //     { id: "travelerType", title: "Traveler Type" },
        //     { id: "roomInfo", title: "Room Info" },
        //   ]);
        // }
        return allReviews;
    }
    catch (error) {
        console.error("Error in scrapeBookingService:", error);
        throw error;
    }
    finally {
        if (browser) {
            yield browser.disconnect();
        }
    }
});
exports.scrapeBookingService = scrapeBookingService;
