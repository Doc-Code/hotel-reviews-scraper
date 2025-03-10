require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { Parser } = require("json2csv");
const csv = require("csv-parse/sync");
const fs = require("fs").promises;
const path = require("path");
// const { scrapeGoogleMapsReviews } = require("./scrapers/googleMaps");
const {
  scrapeBookingReviews,
  isValidBookingUrl,
} = require("./scrapers/booking");
const userStateManager = require("./utils/userStateManager");
const fileDb = require("./utils/fileDb");
const openaiService = require("./services/openaiService");

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is not set in .env file");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const app = express();

// Очистка зависших состояний каждые 30 минут
setInterval(() => {
  userStateManager.clearStaleStates(30);
}, 30 * 60 * 1000);

// Клавиатуры
const sourceKeyboard = {
  reply_markup: {
    keyboard: [[{ text: "Google Maps" }, { text: "Booking.com" }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

const reviewActionKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "Получить CSV", callback_data: "get_csv" },
        { text: "Анализ отзывов", callback_data: "analyze_reviews" },
      ],
      [{ text: "Показать статистику", callback_data: "show_stats" }],
    ],
  },
};

// Start command handler
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  if (await fileDb.isAuthorized(chatId)) {
    await bot.sendMessage(chatId, "Выберите источник отзывов:", sourceKeyboard);
  } else {
    const welcomeMessage = `
🤖 Добро пожаловать в AI TEXTURA Reviews!

📚 Инструкция по использованию:
https://telegra.ph/Ai-Textura--Reviews-03-10

🔑 Для получения пароля обратитесь к @drcode

💡 Возможности бота:
• Сбор отзывов с Booking.com
• AI-анализ отзывов и ответов менеджера
• Генерация рекомендаций по ответам
• Экспорт в Google Таблицы для детального анализа
• Анализ тональности отзывов
• Предложения по улучшению сервиса

Пожалуйста, введите пароль для доступа к боту.`;

    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "HTML" });
  }
});

// Message handler с улучшенной обработкой ошибок
bot.on("message", async (msg) => {
  try {
    if (!msg || !msg.chat) {
      console.error("Некорректное сообщение:", msg);
      return;
    }

    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) {
      await bot.sendMessage(
        chatId,
        "Пожалуйста, отправьте текстовое сообщение"
      );
      return;
    }

    // Пропускаем обработку команды /start, так как она обрабатывается отдельно
    if (text === "/start") {
      return;
    }

    // Обработка команды отмены
    if (text === "/cancel") {
      const userState = await userStateManager.getUserState(chatId);
      if (userState.isBusy) {
        await userStateManager.setFree(chatId);
        await bot.sendMessage(chatId, "✅ Операция отменена");
        await bot.sendMessage(
          chatId,
          "Выберите источник отзывов:",
          sourceKeyboard
        );
      } else {
        await bot.sendMessage(chatId, "❌ Нет активных операций для отмены");
      }
      return;
    }

    try {
      // Проверяем авторизацию
      if (!(await fileDb.isAuthorized(chatId))) {
        const authorized = await fileDb.authorizeUser(chatId, text);
        if (authorized) {
          await bot.sendMessage(
            chatId,
            "✅ Доступ предоставлен! Выберите источник отзывов:",
            sourceKeyboard
          );
        } else {
          await bot.sendMessage(
            chatId,
            "❌ Неверный пароль. Для получения пароля обратитесь к @drcode"
          );
        }
        return;
      }

      // Проверяем состояние пользователя
      const userState = await userStateManager.getUserState(chatId);
      if (userState.isBusy && text !== "/cancel") {
        await bot.sendMessage(
          chatId,
          `⏳ В данный момент идет обработка запроса для ${userState.source}.\nДождитесь завершения или используйте команду /cancel для отмены.`
        );
        return;
      }

      // Остальная логика обработки сообщений
      await handleAuthorizedMessage(msg);
    } catch (error) {
      console.error("Ошибка при обработке сообщения:", error);
      await bot.sendMessage(
        chatId,
        "Произошла ошибка при обработке запроса. Попробуйте позже."
      );
      // В случае ошибки освобождаем пользователя
      await userStateManager.setFree(chatId);
    }
  } catch (error) {
    console.error("Критическая ошибка в обработчике сообщений:", error.message);
  }
});

// Глобальная обработка необработанных ошибок
process.on("uncaughtException", (error) => {
  console.error("Необработанная ошибка:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Необработанное отклонение промиса:", error);
});

// Добавляем обработку ошибок для бота
bot.on("polling_error", (error) => {
  console.error("Ошибка polling:", error);
});

bot.on("webhook_error", (error) => {
  console.error("Ошибка webhook:", error);
});

// Callback query handler с улучшенной обработкой ошибок
bot.on("callback_query", async (query) => {
  try {
    // Проверяем наличие необходимых данных
    if (!query || !query.message || !query.message.chat) {
      console.error("Некорректный callback_query:", query);
      await bot.answerCallbackQuery(query.id, {
        text: "Ошибка обработки запроса. Попробуйте отправить команду заново.",
        show_alert: true,
      });
      return;
    }

    const chatId = query.message.chat.id;

    if (!(await fileDb.isAuthorized(chatId))) {
      await bot.answerCallbackQuery(query.id, {
        text: "Необходима авторизация",
      });
      return;
    }

    const action = query.data;
    const sessionId = await userStateManager.getSessionId(chatId);

    if (!sessionId) {
      await bot.answerCallbackQuery(query.id, {
        text: "Сессия не найдена. Пожалуйста, отправьте ссылку на отель заново.",
        show_alert: true,
      });
      return;
    }

    const session = await fileDb.getReviewSession(chatId, sessionId);
    if (!session) {
      await bot.answerCallbackQuery(query.id, {
        text: "Данные сессии не найдены. Пожалуйста, отправьте ссылку на отель заново.",
        show_alert: true,
      });
      return;
    }

    // Проверяем состояние пользователя перед выполнением действий
    const userState = await userStateManager.getUserState(chatId);
    if (userState.isBusy) {
      await bot.answerCallbackQuery(query.id, {
        text: `В данный момент идет обработка запроса для ${userState.source}. Дождитесь завершения.`,
        show_alert: true,
      });
      return;
    }

    try {
      switch (action) {
        case "get_csv":
          await handleGetCsv(chatId, session);
          break;
        case "analyze_reviews":
          if (session.analyzed) {
            const filename = `reviews_${session.sessionId}_analyzed.csv`;
            const filePath = path.join(process.cwd(), "data", filename);

            try {
              await fs.access(filePath);
              await bot.sendDocument(chatId, filePath, {
                caption: "Анализ отзывов",
              });
            } catch (error) {
              console.error("Ошибка при доступе к файлу:", error);
              await bot.sendMessage(
                chatId,
                "Файл анализа не найден. Попробуйте запустить анализ заново."
              );
            }
          } else {
            await handleAnalyzeReviews(chatId, session);
          }
          break;
        case "show_stats":
          await handleShowStats(chatId, session);
          break;
        default:
          await bot.answerCallbackQuery(query.id, {
            text: "Неизвестное действие",
            show_alert: true,
          });
          return;
      }
      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error(
        `Error handling callback query action ${action}:`,
        error.message
      );
      await bot.answerCallbackQuery(query.id, {
        text: "Произошла ошибка при обработке запроса. Попробуйте позже.",
        show_alert: true,
      });

      // В случае ошибки освобождаем пользователя
      await userStateManager.setFree(chatId);
    }
  } catch (error) {
    console.error(
      "Критическая ошибка в обработчике callback_query:",
      error.message
    );
    try {
      await bot.answerCallbackQuery(query.id, {
        text: "Произошла критическая ошибка. Попробуйте позже.",
        show_alert: true,
      });
    } catch (e) {
      console.error("Не удалось отправить ответ на callback_query:", e);
    }
  }
});

async function handleAuthorizedMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "Google Maps") {
    await bot.sendMessage(
      chatId,
      "⚠️ Извините, сбор отзывов с Google Maps временно недоступен.\n\nПожалуйста, используйте Booking.com для анализа отзывов.",
      sourceKeyboard
    );
  } else if (text === "Booking.com") {
    await bot.sendMessage(
      chatId,
      "Пожалуйста, отправьте ссылку на отель в Booking.com\nПример: https://www.booking.com/hotel/your-hotel-url"
    );
  } else if (text.includes("booking.com")) {
    await handleBookingUrl(chatId, text);
  } else if (text.includes("google.com/maps") || text.includes("maps.google")) {
    await bot.sendMessage(
      chatId,
      "⚠️ Извините, сбор отзывов с Google Maps временно недоступен.\n\nПожалуйста, используйте Booking.com для анализа отзывов.",
      sourceKeyboard
    );
  }
}

async function handleBookingUrl(chatId, url) {
  if (!isValidBookingUrl(url)) {
    await bot.sendMessage(
      chatId,
      "Неверная ссылка. Пожалуйста, предоставьте корректную ссылку на отель Booking.com"
    );
    return;
  }

  await userStateManager.setBusy(chatId, "Booking.com");
  const statusMessage = await bot.sendMessage(
    chatId,
    "Начинаю сбор отзывов с Booking.com..."
  );

  try {
    const reviews = await scrapeBookingReviews(url);
    if (!reviews || reviews.length === 0) {
      await bot.sendMessage(
        chatId,
        "Не удалось найти отзывы. Пожалуйста, проверьте ссылку и попробуйте снова."
      );
      return;
    }

    await bot.editMessageText(`Собрано ${reviews.length} отзывов.`, {
      chat_id: chatId,
      message_id: statusMessage.message_id,
    });

    // Сохраняем сессию и устанавливаем sessionId в состояние пользователя
    const sessionId = await fileDb.saveReviews(chatId, reviews, "Booking.com");
    await userStateManager.setSessionId(chatId, sessionId);

    // Показываем статистику с кнопками
    await handleShowStats(chatId, {
      reviews,
      stats: fileDb.calculateStats(reviews),
      analyzed: false,
    });
  } catch (error) {
    console.error("Error processing Booking.com reviews:", error.message);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при сборе отзывов. Пожалуйста, проверьте ссылку и попробуйте снова."
    );
  } finally {
    await userStateManager.setFree(chatId);
  }
}

async function handleGetCsv(chatId, session) {
  const filename = `reviews_${session.sessionId}.csv`;
  const filePath = path.join(process.cwd(), "data", filename);

  // Проверяем, существует ли файл
  try {
    await fs.access(filePath);
  } catch {
    // Если файл не существует, создаем его
    await saveReviewsToCsv(session.reviews, filename);
  }

  await bot.sendDocument(chatId, filePath, {
    caption: `Файл содержит ${session.reviews.length} отзывов`,
  });
}

async function handleAnalyzeReviews(chatId, session) {
  // Проверяем, не идет ли уже анализ для этого пользователя
  const userState = await userStateManager.getUserState(chatId);
  if (userState.isBusy && userState.source === "analysis") {
    await bot.sendMessage(
      chatId,
      "⚠️ Анализ отзывов уже выполняется. Дождитесь завершения текущего анализа."
    );
    return;
  }

  const analyzedFilename = `reviews_${session.sessionId}_analyzed.csv`;
  const analyzedFilePath = path.join(process.cwd(), "data", analyzedFilename);

  if (session.analyzed) {
    try {
      // Проверяем существование файла
      await fs.access(analyzedFilePath);
      await bot.sendDocument(chatId, analyzedFilePath, {
        caption: "Анализ уже был выполнен ранее",
      });
      return;
    } catch {
      // Если файл не найден, но сессия помечена как проанализированная,
      // пересоздадим файл из данных сессии
      await saveReviewsToCsv(session.reviews, analyzedFilename);
      await bot.sendDocument(chatId, analyzedFilePath, {
        caption: "Анализ уже был выполнен ранее",
      });
      return;
    }
  }

  // Устанавливаем состояние "занят анализом"
  await userStateManager.setBusy(chatId, "analysis");

  const statusMessage = await bot.sendMessage(
    chatId,
    "Начинаю анализ отзывов..."
  );
  let progress = 0;

  try {
    const analyzedReviews = await openaiService.analyzeReviewBatch(
      session.reviews,
      session.sessionId,
      async (completed, total) => {
        progress = Math.round((completed / total) * 100);
        await bot.editMessageText(
          `Анализ отзывов: ${progress}% (${completed}/${total})`,
          {
            chat_id: chatId,
            message_id: statusMessage.message_id,
          }
        );
      }
    );

    // Сохраняем результаты анализа в сессию
    await fileDb.updateReviewSession(chatId, session.sessionId, {
      reviews: analyzedReviews,
      analyzed: true,
    });

    // Сохраняем результаты в CSV
    await saveReviewsToCsv(analyzedReviews, analyzedFilename);

    await bot.sendDocument(chatId, analyzedFilePath, {
      caption: "Анализ отзывов завершен",
    });
  } catch (error) {
    console.error("Error analyzing reviews:", error);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при анализе отзывов. Пожалуйста, попробуйте позже."
    );
  } finally {
    // В любом случае освобождаем пользователя
    await userStateManager.setFree(chatId);
  }
}

async function handleShowStats(chatId, session) {
  const { stats } = session;
  if (!stats) {
    await bot.sendMessage(chatId, "Статистика недоступна");
    return;
  }

  let message = `📊 Статистика отзывов:\n`;
  message += `Всего отзывов: ${stats.totalReviews}\n`;
  message += `Средняя оценка: ${stats.averageRating}\n\n`;
  message += `👥 Типы путешественников:\n`;

  Object.entries(stats.reviewsByType).forEach(([type, count]) => {
    message += `${type}: ${count} (${Math.round(
      (count / stats.totalReviews) * 100
    )}%)\n`;
  });

  // Добавляем кнопки действий прямо в сообщение со статистикой
  const buttons = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📥 Получить CSV", callback_data: "get_csv" },
          { text: "🤖 Анализ отзывов", callback_data: "analyze_reviews" },
        ],
      ],
    },
  };

  // Если анализ уже был выполнен, меняем текст кнопки
  if (session.analyzed) {
    buttons.reply_markup.inline_keyboard[0][1].text = "📊 Получить анализ";
  }

  await bot.sendMessage(chatId, message, buttons);
}

async function saveReviewsToCsv(reviews, filename) {
  const filePath = path.join(process.cwd(), "data", filename);

  // Исключаем ненужные поля из каждого отзыва
  const cleanReviews = reviews.map((review) => {
    const { hotelRatingScores, helpfulVotes, hotelId, images, ...rest } =
      review;
    return rest;
  });

  // Если это файл с анализом, читаем существующий файл и добавляем новые поля
  if (filename.includes("_analyzed")) {
    try {
      // Получаем имя оригинального файла
      const originalFilename = filename.replace("_analyzed", "");
      const originalFilePath = path.join(
        process.cwd(),
        "data",
        originalFilename
      );

      // Читаем оригинальный CSV и парсим его
      const originalContent = await fs.readFile(originalFilePath, "utf-8");
      const originalData = csv.parse(originalContent, {
        columns: true,
        skip_empty_lines: true,
      });

      // Объединяем данные
      const mergedData = originalData.map((original, index) => ({
        ...original,
        ...cleanReviews[index],
      }));

      const json2csvParser = new Parser();
      const newCsv = json2csvParser.parse(mergedData);
      await fs.writeFile(filePath, newCsv);
      return filePath;
    } catch (error) {
      console.error("Ошибка при объединении данных:", error);
    }
  }

  // Для обычного файла просто сохраняем как есть
  const json2csvParser = new Parser();
  const newCsv = json2csvParser.parse(cleanReviews);
  await fs.writeFile(filePath, newCsv);
  return filePath;
}

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
