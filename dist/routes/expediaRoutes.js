"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const expediaController_1 = require("../controllers/expediaController");
const router = express_1.default.Router();
router.get("/", expediaController_1.scrapeExpedia);
exports.default = router;
