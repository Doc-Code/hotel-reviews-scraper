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
exports.scrapeExpediaService = void 0;
const apify_1 = require("../utils/apify");
const scrapeExpediaService = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const items = yield (0, apify_1.runApifyActor)("apify/expedia-scraper", {
            search: "Ghana",
            maxReviews: 100,
            includeReviews: true,
        });
        const reviews = items.flatMap((item) => item.reviews.map((review) => ({
            hotel: item.name,
            rating: review.rating,
            date: review.date,
            content: review.text,
        })));
        // await saveToCSV(reviews, "expedia_reviews.csv", [
        //   { id: "hotel", title: "Hotel" },
        //   { id: "rating", title: "Rating" },
        //   { id: "date", title: "Date" },
        //   { id: "content", title: "Content" },
        // ]);
        return reviews;
    }
    catch (error) {
        console.error("Error in scrapeExpediaService:", error);
        throw error;
    }
});
exports.scrapeExpediaService = scrapeExpediaService;
