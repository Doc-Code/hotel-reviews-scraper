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
exports.runApifyActor = void 0;
const apify_client_1 = require("apify-client");
// Initialize the ApifyClient with your API token
const client = new apify_client_1.ApifyClient({
    token: process.env.APIFY_API_KEY,
});
const runApifyActor = (actorId, runInput) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Starting scraping using Apify actor: ${actorId}`);
        const run = yield client.actor(actorId).call(runInput);
        const { items } = yield client.dataset(run.defaultDatasetId).listItems();
        console.log(`Scraped ${items.length} items using Apify actor: ${actorId}`);
        return items;
    }
    catch (error) {
        console.error(`Error in Apify actor run (${actorId}):`, error);
        throw error;
    }
});
exports.runApifyActor = runApifyActor;
