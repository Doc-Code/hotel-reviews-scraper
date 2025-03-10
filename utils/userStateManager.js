const fs = require("fs").promises;
const path = require("path");

class UserStateManager {
  constructor() {
    this.dbPath = path.join(process.cwd(), "data", "states");
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.dbPath, { recursive: true });
    } catch (error) {
      console.error("Error initializing UserStateManager:", error);
    }
  }

  async loadState(chatId) {
    try {
      const stateFile = path.join(this.dbPath, `${chatId}.json`);
      const data = await fs.readFile(stateFile, "utf8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveState(chatId, state) {
    const stateFile = path.join(this.dbPath, `${chatId}.json`);
    await fs.writeFile(stateFile, JSON.stringify(state));
  }

  async isUserBusy(chatId) {
    const state = await this.loadState(chatId);
    return state?.isBusy || false;
  }

  async setBusy(chatId, source) {
    const currentState = (await this.loadState(chatId)) || {};
    await this.saveState(chatId, {
      ...currentState,
      isBusy: true,
      source: source,
      startTime: Date.now(),
    });
  }

  async setFree(chatId) {
    const currentState = (await this.loadState(chatId)) || {};
    await this.saveState(chatId, {
      ...currentState,
      isBusy: false,
    });
  }

  async getUserState(chatId) {
    return (await this.loadState(chatId)) || {};
  }

  async setSessionId(chatId, sessionId) {
    const currentState = (await this.loadState(chatId)) || {};
    await this.saveState(chatId, {
      ...currentState,
      sessionId: sessionId,
    });
  }

  async getSessionId(chatId) {
    const state = await this.loadState(chatId);
    return state?.sessionId || null;
  }

  async clearStaleStates(timeoutMinutes = 30) {
    try {
      const files = await fs.readdir(this.dbPath);
      const now = Date.now();

      for (const file of files) {
        const chatId = file.replace(".json", "");
        const state = await this.loadState(chatId);

        if (
          state?.startTime &&
          now - state.startTime > timeoutMinutes * 60 * 1000
        ) {
          await this.setFree(chatId);
        }
      }
    } catch (error) {
      console.error("Error clearing stale states:", error);
    }
  }
}

module.exports = new UserStateManager();
