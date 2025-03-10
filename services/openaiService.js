const OpenAI = require("openai");
const fileDb = require("../utils/fileDb");

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID,
      projectId: process.env.OPENAI_PROJECT_ID,
    });
  }

  async analyzeReview(review, sessionId) {
    try {
      // Получаем все предыдущие теги для этой сессии из файловой системы
      const existingTags = await fileDb.getSessionTags(sessionId);
      const existingTagsStr =
        existingTags.length > 0 ? existingTags.join(", ") : "";

      const prompt = `Проанализируйте этот отзыв об отеле и предоставьте структурированный анализ в формате JSON:

Отзыв от ${review.userName || "Анонимного пользователя"} (${
        review.travelerType || "тип не указан"
      })
Оценка: ${review.rating}/10
Дата проживания: ${review.checkInDate || "не указана"}
Длительность: ${review.numberOfNights || "не указано"} ночей

Заголовок отзыва: 
${review.reviewTitle || "не указан"}

Положительные впечатления:
${review.likedText || "не указаны"}

Отрицательные впечатления:
${review.dislikedText || "не указаны"}

Ответ отеля (если есть):
${review.propertyResponse || "нет ответа"}

Язык отзыва (если есть):
${review.reviewLanguage || "en"}

Предыдущие анализы использовали следующие теги:
${existingTagsStr}

Предоставьте ответ в следующем формате JSON:
{
  "tags": {
    "positive": ["тег1", "тег2"],
    "negative": ["тег1", "тег2"]
  },
  "managerResponse": {
    "exists": true/false,
    "quality": "оценка качества ответа менеджера",
    "improvements": "как можно улучшить ответ"
  },
  "suggestedResponse": "эмпатический ответ на отзыв (50-100 слов) на языке отзыва",
  "suggestedResponseRU": "suggestedResponse на русском языке",
  "summary": "краткое саммари отзыва (до 10 слов)"
}

Правила:
1. Используйте существующие теги, если они подходят
2. Создавайте новые теги, только если нет подходящих существующих
3. Теги должны быть конкретными, но краткими (1-2 слова)
4. Оценка работы менеджера только если есть ответ отеля
5. Эмпатический ответ должен быть персонализированным и адресовать ключевые моменты отзыва
6. Саммари должно отражать главную суть отзыва`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Вы - система анализа отзывов об отелях. Ваша задача - предоставить структурированный анализ в формате JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const analysis = JSON.parse(response.choices[0].message.content);

      // Сохраняем новые теги в файловую систему
      const allTags = [...analysis.tags.positive, ...analysis.tags.negative];
      const newTags = allTags.filter((tag) => !existingTags.includes(tag));

      if (newTags.length > 0) {
        await fileDb.addSessionTags(sessionId, newTags);
      }

      return {
        tags: `${analysis.tags.positive.join(
          ","
        )}/${analysis.tags.negative.join(",")}`,
        managerResponseAnalysis: analysis.managerResponse.exists
          ? `Качество: ${analysis.managerResponse.quality}\nУлучшения: ${analysis.managerResponse.improvements}`
          : "Нет ответа менеджера",
        suggestedResponse: analysis.suggestedResponse,
        suggestedResponseRU: analysis.suggestedResponseRU,
        summary: analysis.summary,
      };
    } catch (error) {
      console.error("Error analyzing review:", error);
      return {
        tags: "ошибка_анализа/ошибка_анализа",
        managerResponseAnalysis: "Ошибка анализа",
        suggestedResponse: "Ошибка анализа",
        suggestedResponseRU: "Ошибка анализа",
        summary: "Ошибка анализа",
      };
    }
  }

  async analyzeReviewBatch(reviews, sessionId, progressCallback) {
    const results = [];
    let completed = 0;

    for (const review of reviews) {
      try {
        const analysis = await this.analyzeReview(review, sessionId);
        results.push({
          ...review,
          aiAnalysis: analysis.tags,
          managerResponseAnalysis: analysis.managerResponseAnalysis,
          suggestedResponse: analysis.suggestedResponse,
          suggestedResponseRU: analysis.suggestedResponseRU,
          summary: analysis.summary,
        });

        completed++;
        if (progressCallback) {
          await progressCallback(completed, reviews.length);
        }
      } catch (error) {
        console.error(`Error analyzing review:`, error);
        results.push({
          ...review,
          aiAnalysis: "ошибка_анализа/ошибка_анализа",
          managerResponseAnalysis: "Ошибка анализа",
          suggestedResponse: "Ошибка анализа",
          suggestedResponseRU: "Ошибка анализа",
          summary: "Ошибка анализа",
        });
      }

      // Пауза между запросами для избежания rate limits
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return results;
  }
}

module.exports = new OpenAIService();
