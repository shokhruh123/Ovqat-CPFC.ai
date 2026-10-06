import { GoogleGenAI } from "@google/genai";

/**
 * Цепочка моделей Gemini с fallback — по образцу yolguard/backend/app/services/ai.py.
 * Старая захардкоженная модель может быть снята с публикации (404) или
 * перегружена (503/429) — первая ответившая модель выигрывает.
 * Переопределение: GEMINI_MODEL=... в .env.local
 */
const DEFAULT_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"];

const override = (process.env.GEMINI_MODEL || "").trim();
export const GEMINI_MODELS = override ? [override] : DEFAULT_MODELS;

export const SYSTEM_INSTRUCTION = `Ты — профессиональный нутрициолог и эксперт по анализу состава блюд.
Проанализируй предоставленное изображение еды.
Определи название блюда, примерный вес порции в граммах, калорийность и БЖУ (белки, жиры, углеводы в граммах).
Дай краткую рекомендацию (вердикт и совет) о том, стоит ли есть этот продукт при правильном питании.

Верни ответ СТРОГО в формате JSON без разметки markdown codeblock:
{
  "is_food": boolean,
  "food_name": "string",
  "estimated_weight_g": number,
  "calories": number,
  "macronutrients": {
    "proteins_g": number,
    "fats_g": number,
    "carbs_g": number
  },
  "variants": {
    "lean": {
      "label": "string (например: Домашний)",
      "calories": number,
      "macronutrients": { "proteins_g": number, "fats_g": number, "carbs_g": number },
      "note": "string (до 120 символов: чем версия легче)"
    },
    "rich": {
      "label": "string (например: Чайхана)",
      "calories": number,
      "macronutrients": { "proteins_g": number, "fats_g": number, "carbs_g": number },
      "note": "string (до 120 символов: чем версия жирнее)"
    }
  },
  "recommendation_verdict": "Рекомендуется" | "С осторожностью" | "Не рекомендуется",
  "short_advice": "string (краткий совет на русском языке до 200 символов)"
}
ВАЖНО ПРО РАЗБРОС: одно и то же блюдо бывает очень разным. "lean" — облегчённая домашняя версия (меньше масла и жира, постное мясо, без фритюра и обильного соуса). "rich" — жирная версия из чайханы, кафе или фастфуда (много масла, курдюк, казан, фритюр, соусы). Калории и БЖУ вариантов считай на тот же вес порции. Если способ приготовления почти не влияет на калорийность (яблоко, огурец, варёное яйцо), варианты должны быть близки к основной оценке — не выдумывай разброс.
Если на фото нет еды, установи "is_food": false, дай понятное объяснение в "short_advice" и опусти поле "variants".`;

export function cleanJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isTransient(msg: string): boolean {
  return /429|503|overload|quota|rate|timeout|fetch failed|network/i.test(msg);
}

export interface GeminiResult {
  json: unknown;
  model: string;
}

/** Генерация с перебором моделей + 1 ретрай на транзиентных ошибках. */
export async function generateFoodJson(
  apiKey: string,
  base64: string,
  mimeType: string
): Promise<GeminiResult> {
  const ai = new GoogleGenAI({ apiKey });
  let lastErr = "no model answered";

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { text: "Что на фото? Верни только JSON по инструкции." },
                { inlineData: { mimeType, data: base64 } },
              ],
            },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        });

        const raw = response.text?.trim() ?? "";
        if (!raw) throw new Error("empty_response");
        return { json: JSON.parse(cleanJson(raw)), model };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        lastErr = `${model}: ${msg.slice(0, 120)}`;
        // 404 = модель снята с публикации → сразу следующая, без ретрая
        if (/404|not found/i.test(msg)) break;
        if (isTransient(msg) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        break;
      }
    }
  }
  throw new Error(lastErr);
}
