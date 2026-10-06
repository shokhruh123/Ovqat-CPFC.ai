/**
 * Запасной провайдер через OpenRouter (OpenAI-совместимый API).
 * Бесплатные vision-модели смотреть тут: https://openrouter.ai/models
 * Модель задаётся переменной OPENROUTER_MODEL (список бесплатных меняется,
 * поэтому дефолт — пример, проверьте актуальный :free список на сайте).
 */
import { cleanJson } from "@/lib/gemini";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const FOOD_PROMPT = `Ты — профессиональный нутрициолог. Проанализируй фото еды и верни СТРОГО JSON без markdown-обёртки:
{"is_food": boolean, "food_name": "string", "estimated_weight_g": number, "calories": number,
"macronutrients": {"proteins_g": number, "fats_g": number, "carbs_g": number},
"variants": {"lean": {"label": "Домашний", "calories": number,
"macronutrients": {"proteins_g": number, "fats_g": number, "carbs_g": number},
"note": "до 120 символов: чем версия легче"},
"rich": {"label": "Чайхана", "calories": number,
"macronutrients": {"proteins_g": number, "fats_g": number, "carbs_g": number},
"note": "до 120 символов: чем версия жирнее"}},
"recommendation_verdict": "Рекомендуется" | "С осторожностью" | "Не рекомендуется",
"short_advice": "краткий совет на русском до 200 символов"}
lean — домашняя версия (меньше масла, постное мясо). rich — жирная версия из чайханы/фастфуда (много масла, курдюк, фритюр). Калории вариантов — на тот же вес. Если способ готовки почти не влияет (яблоко, огурец), варианты близки к оценке, разброс не выдумывай. Если еды нет: "is_food": false, объяснение в "short_advice", без "variants".`;

export interface OpenRouterResult {
  json: unknown;
  model: string;
}

export async function generateFoodJsonViaOpenRouter(
  apiKey: string,
  model: string,
  base64: string,
  mime: string
): Promise<OpenRouterResult> {
  const r = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/shokhruh123/Ovqat-CPFC.ai",
      "X-Title": "Ovqat CPFC.ai",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            { type: "text", text: FOOD_PROMPT },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.2,
    }),
  });

  if (r.status === 401 || r.status === 403) {
    throw new Error("bad_token: проверьте OPENROUTER_KEY (https://openrouter.ai/keys)");
  }
  if (r.status === 402) {
    throw new Error("no_credits: на балансе OpenRouter нет кредитов/лимита для этой модели");
  }
  if (r.status === 429) throw new Error("429: исчерпан лимит OpenRouter, подождите минуту");
  if (!r.ok) throw new Error(`openrouter_http_${r.status}`);

  const data = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (data.error) throw new Error(`openrouter: ${data.error.message ?? "unknown"}`);
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("empty_response");
  return { json: JSON.parse(cleanJson(text)), model };
}
