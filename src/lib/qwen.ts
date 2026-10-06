/**
 * Qwen-провайдер через Hugging Face Inference API (OpenAI-совместимый эндпоинт).
 * Модель Qwen3.5-0.8B — мультимодальная (image-text-to-text), Apache 2.0.
 * Параметры сэмплирования для VL-задач — из официальной документации модели.
 */
import { cleanJson } from "@/lib/gemini";

const HF_ROUTER = "https://router.huggingface.co/v1/chat/completions";
export const QWEN_MODEL = "Qwen/Qwen3.5-0.8B";

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

export interface QwenResult {
  json: unknown;
  model: string;
}

async function once(hfToken: string, base64: string, mime: string): Promise<Response> {
  return fetch(HF_ROUTER, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hfToken}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
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
      temperature: 0.7,
      top_p: 0.8,
      presence_penalty: 1.5,
    }),
  });
}

export async function generateFoodJsonViaQwen(
  hfToken: string,
  base64: string,
  mime: string
): Promise<QwenResult> {
  let lastErr = "no answer";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await once(hfToken, base64, mime);
      if (r.status === 401 || r.status === 403) {
        throw new Error("bad_token: проверьте HF_TOKEN (Settings → Access Tokens)");
      }
      if (r.status === 429) {
        lastErr = "429: исчерпан лимит бесплатного HF Inference";
        break;
      }
      if (r.status === 503) {
        // Модель холодная, прогревается — ждём и повторяем один раз
        lastErr = "503: модель прогревается";
        await new Promise((res) => setTimeout(res, 12000));
        continue;
      }
      if (!r.ok) {
        lastErr = `http_${r.status}`;
        break;
      }
      const data = (await r.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: unknown;
      };
      const text = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) throw new Error("empty_response");
      return { json: JSON.parse(cleanJson(text)), model: QWEN_MODEL };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/bad_token|429/.test(msg)) throw e;
      lastErr = msg.slice(0, 120);
      if (attempt === 0) await new Promise((res) => setTimeout(res, 3000));
    }
  }
  throw new Error(lastErr);
}
