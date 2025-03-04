"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
dotenv_1.default.config();
const airbnbRoutes_1 = __importDefault(require("./routes/airbnbRoutes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Add rate limiter
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);
// Define routes
// app.use("/scrape/expedia", expediaRoutes);
app.use("/scrape/airbnb", airbnbRoutes_1.default);
// app.use("/scrape/booking", bookingRoutes);
// app.use("/scrape/tripadvisor", tripadvisorRoutes);
exports.default = app;
