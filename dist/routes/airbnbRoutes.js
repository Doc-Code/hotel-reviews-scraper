"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const airbnbController_1 = require("../controllers/airbnbController");
const router = express_1.default.Router();
router.get("/", airbnbController_1.scrapeAirbnb);
exports.default = router;
