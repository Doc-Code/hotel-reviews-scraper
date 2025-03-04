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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeAirbnbService = void 0;
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const csvWriter_1 = require("../utils/csvWriter");
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
const AIRBNB_URL = "https://www.airbnb.com/s/Kumasi--Ashanti-Region--Ghana/homes";
const MAX_REVIEWS = 100;
const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
];
const scrapeAirbnbService = () => __awaiter(void 0, void 0, void 0, function* () {
    const browser = yield puppeteer_extra_1.default.launch({
        headless: Math.random() > 0.5 ? "new" : false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = yield browser.newPage();
    const listingDetails = [];
    const allListings = []; // Declare allListings here
    try {
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        yield page.setUserAgent(randomUserAgent);
        yield page.setExtraHTTPHeaders({
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.airbnb.com",
        });
        let currentPage = 1;
        let currentUrl = AIRBNB_URL;
        while (true) {
            yield page.goto(currentUrl, { waitUntil: "networkidle2" });
            yield randomDelay();
            console.log(`Navigating to Airbnb URL (Page ${currentPage}):`, currentUrl);
            const pageListings = yield scrapeListings(page);
            allListings.push(...pageListings);
            console.log(`Number of hotels found on page ${currentPage}:`, pageListings.length);
            // Try to find the next button, but don't throw an error if it's not found
            const nextButton = yield page.$('a[aria-label="Next"]');
            if (!nextButton) {
                console.log("No more pages to scrape. Reached the last page.");
                break;
            }
            const nextPageUrl = yield nextButton.evaluate((el) => el.href);
            if (!nextPageUrl) {
                console.log("Unable to find next page URL. Stopping pagination.");
                break;
            }
            currentUrl = nextPageUrl;
            currentPage++;
            yield randomDelay(); // Add random delay before navigating to the next page
        }
        console.log(`Total number of listings found: ${allListings.length}`);
        // Now scrape details for each listing
        for (let i = 0; i < allListings.length; i++) {
            const listing = allListings[i];
            if (listing.name && listing.title) {
                console.log(`Scraping hotel ${i + 1}/${allListings.length}: ${listing.name}`);
                try {
                    const details = yield scrapeListingDetails(page, listing);
                    listingDetails.push(details);
                    yield randomDelay();
                }
                catch (error) {
                    console.error(`Error scraping hotel ${i + 1}: ${listing.name}`, error);
                    // Save progress before moving to the next listing
                    yield saveProgress(listingDetails, i + 1, allListings.length);
                }
            }
        }
        // Prepare data for CSV
        const csvData = prepareCsvData(listingDetails);
        // Define headers
        const headers = [
            "Hotel",
            "Overall Rating",
            "Cleanliness",
            "Accuracy",
            "Communication",
            "Location",
            "Check-in",
            "Value",
            "Review Rating",
            "Review Date",
            "Stay Duration",
            "Review Content",
            "Reviewer",
        ];
        // Save to CSV
        yield (0, csvWriter_1.saveToCSV)(csvData, headers, "airbnb_listings.csv");
        console.log("Scraping completed successfully");
        return listingDetails;
    }
    catch (error) {
        console.error("Error in scrapeAirbnbService:", error);
        // Save progress before throwing the error
        yield saveProgress(listingDetails, listingDetails.length, allListings.length);
        throw error;
    }
    finally {
        yield browser.close();
    }
});
exports.scrapeAirbnbService = scrapeAirbnbService;
// New function to save progress
function saveProgress(listingDetails, current, total) {
    return __awaiter(this, void 0, void 0, function* () {
        const csvData = prepareCsvData(listingDetails);
        const headers = [
            "Hotel",
            "Overall Rating",
            "Cleanliness",
            "Accuracy",
            "Communication",
            "Location",
            "Check-in",
            "Value",
            "Review Rating",
            "Review Date",
            "Stay Duration",
            "Review Content",
            "Reviewer",
        ];
        const filename = `airbnb_listings_progress_${current}_of_${total || "unknown"}.csv`;
        yield (0, csvWriter_1.saveToCSV)(csvData, headers, filename);
        console.log(`Progress saved: ${current}/${total || "unknown"} listings scraped.`);
    });
}
// Function to prepare CSV data (moved out of the main function for reusability)
function prepareCsvData(listingDetails) {
    return listingDetails.flatMap((listing) => {
        const baseRow = {
            Hotel: listing.hotel,
            "Overall Rating": listing.overallRating,
            Cleanliness: listing.cleanliness,
            Accuracy: listing.accuracy,
            Communication: listing.communication,
            Location: listing.location,
            "Check-in": listing.checkin,
            Value: listing.value,
        };
        return listing.reviews.map((review, index) => (Object.assign(Object.assign(Object.assign({}, baseRow), { "Review Rating": review.rating, "Review Date": review.date, "Stay Duration": review.stayDuration, "Review Content": review.content, Reviewer: review.reviewer }), (index > 0
            ? {
                Hotel: "",
                "Overall Rating": "",
                Cleanliness: "",
                Accuracy: "",
                Communication: "",
                Location: "",
                "Check-in": "",
                Value: "",
            }
            : {}))));
    });
}
function scrapeListingDetails(page, listing) {
    return __awaiter(this, void 0, void 0, function* () {
        yield page.goto(listing.url, { waitUntil: "networkidle0" });
        yield handleCaptcha(page);
        // Extract overall ratings
        const overallRatings = yield page.evaluate(() => {
            const ratingCategories = Array.from(document.querySelectorAll(".l925rvg"));
            const ratings = {};
            ratingCategories.forEach((category) => {
                var _a, _b, _c;
                const name = ((_b = (_a = category
                    .querySelector(".l1nqfsv9")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim().toLowerCase()) || "N/A";
                const rating = ((_c = category.querySelector("div:last-child")) === null || _c === void 0 ? void 0 : _c.textContent) || "N/A";
                if (name && rating) {
                    ratings[name] = rating;
                }
            });
            return {
                cleanliness: ratings.cleanliness || "N/A",
                accuracy: ratings.accuracy || "N/A",
                communication: ratings.communication || "N/A",
                location: ratings.location || "N/A",
                checkin: ratings["check-in"] || "N/A",
                value: ratings.value || "N/A",
            };
        });
        // Extract reviews
        const reviews = yield scrapeReviews(page, listing);
        return Object.assign(Object.assign({ hotel: listing.name, overallRating: listing.rating || "N/A" }, overallRatings), { reviews });
    });
}
function scrapeReviews(page, listing) {
    return __awaiter(this, void 0, void 0, function* () {
        const reviewsUrl = new URL(listing.url);
        reviewsUrl.pathname += "/reviews";
        yield page.goto(reviewsUrl.toString(), { waitUntil: "networkidle0" });
        yield handleCaptcha(page);
        try {
            // Wait for the reviews to load with a shorter timeout
            yield page.waitForSelector(".r1are2x1", { timeout: 5000 });
            // Extract reviews using Puppeteer's evaluate function
            const reviews = yield page.evaluate(() => {
                const reviewElements = document.querySelectorAll(".r1are2x1");
                return Array.from(reviewElements).map((element) => {
                    var _a, _b, _c;
                    const ratingElement = element.querySelector(".c5dn5hn span");
                    const rating = ratingElement
                        ? ((_a = ratingElement.textContent.match(/Rating, (\d+) stars?/)) === null || _a === void 0 ? void 0 : _a[1]) || "0"
                        : "0";
                    const dateAndDurationElement = element.querySelector(".s78n3tv");
                    let date = "";
                    let stayDuration = "";
                    if (dateAndDurationElement) {
                        const textContent = dateAndDurationElement.textContent.trim();
                        const parts = textContent.split("·").map((part) => part.trim());
                        date = parts[1] || "";
                        stayDuration = parts[2] || "";
                    }
                    const reviewContent = ((_b = element.querySelector(".r1bctolv span")) === null || _b === void 0 ? void 0 : _b.textContent.trim()) || "";
                    const reviewerName = ((_c = element.querySelector(".hpipapi")) === null || _c === void 0 ? void 0 : _c.textContent.trim()) || "";
                    return {
                        rating,
                        date,
                        stayDuration,
                        content: reviewContent,
                        reviewer: reviewerName,
                    };
                });
            });
            return reviews;
        }
        catch (error) {
            console.log(`No reviews found for listing: ${listing.name}`);
            // Return a single "N/A" review if no reviews are found
            return [
                {
                    rating: "N/A",
                    date: "N/A",
                    stayDuration: "N/A",
                    content: "N/A",
                    reviewer: "N/A",
                },
            ];
        }
    });
}
function scrapeListings(page) {
    return __awaiter(this, void 0, void 0, function* () {
        const listings = yield page.evaluate(() => {
            const items = Array.from(document.querySelectorAll("#site-content .l196t2l1 .fifuzsw .c1yo0219 .cy5jw6o a.l1ovpqvx"));
            return items.map((item) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                const titleElement = (_a = item
                    .closest(".cy5jw6o")) === null || _a === void 0 ? void 0 : _a.querySelector('div[id^="title_"]');
                const nameElement = (_b = item.closest(".cy5jw6o")) === null || _b === void 0 ? void 0 : _b.querySelector(".t6mzqp7");
                const ratingElement = (_c = item
                    .closest(".cy5jw6o")) === null || _c === void 0 ? void 0 : _c.querySelector(".r4a59j5 span[aria-hidden='true']");
                return {
                    name: (_e = (_d = nameElement === null || nameElement === void 0 ? void 0 : nameElement.textContent) === null || _d === void 0 ? void 0 : _d.trim()) !== null && _e !== void 0 ? _e : "Unknown",
                    title: (_g = (_f = titleElement === null || titleElement === void 0 ? void 0 : titleElement.textContent) === null || _f === void 0 ? void 0 : _f.trim()) !== null && _g !== void 0 ? _g : "Unknown",
                    url: item.href,
                    rating: (_j = (_h = ratingElement === null || ratingElement === void 0 ? void 0 : ratingElement.textContent) === null || _h === void 0 ? void 0 : _h.split(" ")[0]) !== null && _j !== void 0 ? _j : "N/A",
                };
            });
        });
        return listings;
    });
}
function randomDelay() {
    const delay = Math.floor(Math.random() * (8000 - 3000 + 1) + 3000); // Random delay between 3-8 seconds
    return new Promise((resolve) => setTimeout(resolve, delay));
}
function handleCaptcha(page) {
    return __awaiter(this, void 0, void 0, function* () {
        const captchaSelector = 'div[class*="captcha"]'; // Adjust this selector based on Airbnb's CAPTCHA implementation
        const isCaptchaPresent = (yield page.$(captchaSelector)) !== null;
        if (isCaptchaPresent) {
            console.log("CAPTCHA detected. Waiting for manual solving...");
            yield page.waitForNavigation({ timeout: 120000 }); // Wait for 2 minutes or until navigation
            return true;
        }
        return false;
    });
}
