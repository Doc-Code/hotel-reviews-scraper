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

      const prompt = `Проанализируйте этот отзыв об отеле и предоставьте теги в формате "положительные_теги/отрицательные_теги":

Отзыв от ${review.userName || "Анонимного пользователя"} (${
        review.travelerType || "тип не указан"
      })
Оценка: ${review.rating}/10
Дата проживания: ${review.checkInDate || "не указана"}
Длительность: ${review.numberOfNights || "не указано"} ночей

Положительные впечатления:
${review.likedText || "не указаны"}

Отрицательные впечатления:
${review.dislikedText || "не указаны"}

Предыдущие анализы использовали следующие теги:
${existingTagsStr}

Правила:
1. Используйте только существующие теги, если они подходят
2. Создавайте новые теги, только если нет подходящих существующих
3. Теги должны быть максимально конкретными, но краткими (1-2 слова)
4. Формат ответа строго: позитивные_теги/негативные_теги
5. Теги разделяются запятыми
6. Если нет позитивных или негативных тегов, оставьте пустое место до или после слеша
7. Пример: чистота,локация,сервис/шум,цена

Ответ должен содержать ТОЛЬКО теги в указанном формате, без дополнительных пояснений.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Вы - система тегирования отзывов об отелях. Ваша задача - преобразовать отзыв в набор тегов, строго следуя формату.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const analysis = response.choices[0].message.content.trim();

      // Сохраняем новые теги в файловую систему
      const [positiveTags, negativeTags] = analysis.split("/");
      const newTags = [];

      if (positiveTags) {
        positiveTags.split(",").forEach((tag) => {
          const trimmedTag = tag.trim();
          if (trimmedTag && !existingTags.includes(trimmedTag)) {
            newTags.push(trimmedTag);
          }
        });
      }
      if (negativeTags) {
        negativeTags.split(",").forEach((tag) => {
          const trimmedTag = tag.trim();
          if (trimmedTag && !existingTags.includes(trimmedTag)) {
            newTags.push(trimmedTag);
          }
        });
      }

      if (newTags.length > 0) {
        await fileDb.addSessionTags(sessionId, newTags);
      }

      return analysis;
    } catch (error) {
      console.error("Error analyzing review:", error);
      return `ошибка_анализа/ошибка_анализа`;
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
          aiAnalysis: analysis,
        });

        completed++;
        if (progressCallback) {
          await progressCallback(completed, reviews.length);
        }
      } catch (error) {
        console.error(`Error analyzing review:`, error);
        results.push({
          ...review,
          aiAnalysis: `ошибка_анализа/ошибка_анализа`,
        });
      }

      // Пауза между запросами для избежания rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return results;
  }
}

module.exports = new OpenAIService();
