const fs = require("fs").promises;
const path = require("path");

const PENDING_REQUESTS_FILE = path.join(
  process.cwd(),
  "data",
  "pendingRequests.json"
);
const AUTH_FILE = path.join(process.cwd(), "data", "authorizedUsers.json");

class FileDB {
  constructor() {
    this.dbPath = path.join(process.cwd(), "data");
    this.usersPath = path.join(this.dbPath, "users");
    this.reviewsPath = path.join(this.dbPath, "reviews");
    this.sessions = new Map();
    this.authorizedUsers = new Set();
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.dbPath, { recursive: true });
      await fs.mkdir(this.usersPath, { recursive: true });
      await fs.mkdir(this.reviewsPath, { recursive: true });
    } catch (error) {
      console.error("Error initializing FileDB:", error);
    }
  }

  // Управление пользователями
  async isAuthorized(chatId) {
    try {
      const userFile = path.join(this.usersPath, `${chatId}.json`);
      await fs.access(userFile);
      const data = await fs.readFile(userFile, "utf8");
      const user = JSON.parse(data);
      return user.authorized || false;
    } catch {
      return false;
    }
  }

  async authorizeUser(chatId, password) {
    const correctPassword = process.env.BOT_PASSWORD;
    if (password !== correctPassword) {
      return false;
    }

    const userFile = path.join(this.usersPath, `${chatId}.json`);
    await fs.writeFile(
      userFile,
      JSON.stringify({
        chatId,
        authorized: true,
        authorizedAt: new Date().toISOString(),
      })
    );
    return true;
  }

  // Управление отзывами
  async saveReviews(chatId, reviews, source) {
    const sessionId = Date.now();
    const reviewFile = path.join(
      this.reviewsPath,
      `${chatId}_${sessionId}.json`
    );

    await fs.writeFile(
      reviewFile,
      JSON.stringify({
        chatId,
        sessionId,
        source,
        timestamp: new Date().toISOString(),
        reviews,
        analyzed: false,
        stats: this.calculateStats(reviews),
      })
    );

    return sessionId;
  }

  async getReviewSession(chatId, sessionId) {
    try {
      const reviewFile = path.join(
        this.reviewsPath,
        `${chatId}_${sessionId}.json`
      );
      const data = await fs.readFile(reviewFile, "utf8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async updateReviewSession(chatId, sessionId, updates) {
    const reviewFile = path.join(
      this.reviewsPath,
      `${chatId}_${sessionId}.json`
    );
    const currentData = await this.getReviewSession(chatId, sessionId);
    if (!currentData) return false;

    const updatedData = { ...currentData, ...updates };
    await fs.writeFile(reviewFile, JSON.stringify(updatedData));
    return true;
  }

  async getUserSessions(chatId) {
    const files = await fs.readdir(this.reviewsPath);
    const userSessions = files.filter((f) => f.startsWith(`${chatId}_`));

    const sessions = await Promise.all(
      userSessions.map(async (file) => {
        const data = await fs.readFile(
          path.join(this.reviewsPath, file),
          "utf8"
        );
        return JSON.parse(data);
      })
    );

    return sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  calculateStats(reviews) {
    const totalReviews = reviews.length;
    if (totalReviews === 0) return null;

    const averageRating = (
      reviews.reduce((acc, rev) => acc + (rev.rating || 0), 0) / totalReviews
    ).toFixed(1);

    const reviewsByType = reviews.reduce((acc, rev) => {
      const type = rev.travelerType || "Не указано";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return {
      totalReviews,
      averageRating,
      reviewsByType,
    };
  }

  // Получить все теги сессии
  async getSessionTags(sessionId) {
    try {
      const sessions = await this.getAllSessions();
      const session = sessions.find((s) => s.sessionId === sessionId);
      return session?.tags || [];
    } catch (error) {
      console.error("Error getting session tags:", error);
      return [];
    }
  }

  // Добавить новые теги в сессию
  async addSessionTags(sessionId, newTags) {
    try {
      const sessions = await this.getAllSessions();
      const session = sessions.find((s) => s.sessionId === sessionId);
      if (!session) return;

      if (!session.tags) {
        session.tags = [];
      }

      // Добавляем только уникальные теги
      newTags.forEach((tag) => {
        if (!session.tags.includes(tag)) {
          session.tags.push(tag);
        }
      });

      // Обновляем файл сессии
      const reviewFile = path.join(
        this.reviewsPath,
        `${session.chatId}_${sessionId}.json`
      );
      await fs.writeFile(reviewFile, JSON.stringify(session));
    } catch (error) {
      console.error("Error adding session tags:", error);
    }
  }

  // Получить все сессии
  async getAllSessions() {
    try {
      const files = await fs.readdir(this.reviewsPath);
      const sessions = await Promise.all(
        files.map(async (file) => {
          const data = await fs.readFile(
            path.join(this.reviewsPath, file),
            "utf8"
          );
          return JSON.parse(data);
        })
      );
      return sessions;
    } catch (error) {
      console.error("Error getting all sessions:", error);
      return [];
    }
  }

  // Модуль должен быть обновлен, чтобы добавить новые функции:

  // isPendingAccess - проверка, находится ли запрос на рассмотрении
  // addPendingAccess - добавление нового запроса на доступ
  // removePendingAccess - удаление запроса после предоставления доступа
  // authorizeUserDirectly - авторизация пользователя без проверки пароля

  // Пример реализации (без полного кода модуля):
  async isPendingAccess(chatId) {
    try {
      const pendingRequests = await this.loadPendingRequests();
      return !!pendingRequests[chatId];
    } catch (error) {
      console.error("Ошибка при проверке ожидающего запроса:", error);
      return false;
    }
  }

  async addPendingAccess(chatId, userData) {
    try {
      const pendingRequests = await this.loadPendingRequests();
      pendingRequests[chatId] = { ...userData, timestamp: Date.now() };
      await this.savePendingRequests(pendingRequests);
      return true;
    } catch (error) {
      console.error("Ошибка при добавлении запроса на доступ:", error);
      return false;
    }
  }

  async removePendingAccess(chatId) {
    try {
      const pendingRequests = await this.loadPendingRequests();
      delete pendingRequests[chatId];
      await this.savePendingRequests(pendingRequests);
      return true;
    } catch (error) {
      console.error("Ошибка при удалении запроса на доступ:", error);
      return false;
    }
  }

  async authorizeUserDirectly(chatId) {
    try {
      const authorizedUsers = await this.loadAuthorizedUsers();
      authorizedUsers[chatId] = { authorized: true, timestamp: Date.now() };
      await this.saveAuthorizedUsers(authorizedUsers);
      return true;
    } catch (error) {
      console.error("Ошибка при прямой авторизации пользователя:", error);
      return false;
    }
  }

  async loadPendingRequests() {
    try {
      const data = await fs.readFile(PENDING_REQUESTS_FILE, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        // Если файл не существует, создаем новый
        await this.savePendingRequests({});
        return {};
      }
      throw error;
    }
  }

  async savePendingRequests(pendingRequests) {
    await fs.writeFile(
      PENDING_REQUESTS_FILE,
      JSON.stringify(pendingRequests, null, 2)
    );
  }

  async loadAuthorizedUsers() {
    try {
      const data = await fs.readFile(AUTH_FILE, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        await this.saveAuthorizedUsers({});
        return {};
      }
      throw error;
    }
  }

  async saveAuthorizedUsers(authorizedUsers) {
    await fs.writeFile(AUTH_FILE, JSON.stringify(authorizedUsers, null, 2));
  }
}

module.exports = new FileDB();
