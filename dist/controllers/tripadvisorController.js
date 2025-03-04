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
exports.scrapeTripAdvisor = void 0;
const tripadvisorService_1 = require("../services/tripadvisorService");
const scrapeTripAdvisor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const reviews = yield (0, tripadvisorService_1.scrapeTripAdvisorService)();
        res.json({
            message: "TripAdvisor scraping completed",
            reviewCount: reviews.length,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Scraping failed" });
    }
});
exports.scrapeTripAdvisor = scrapeTripAdvisor;
