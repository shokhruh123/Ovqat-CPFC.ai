/**
 * Локальный провайдер через Ollama (без токенов и чужих серверов).
 * Модель: qwen3-vl:2b — видит фото, отвечает JSON (format: "json").
 * Ollama должен быть запущен: `ollama serve`, модель скачана: `ollama pull qwen3-vl:2b`.
 */
import { cleanJson } from "@/lib/gemini";

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

export interface OllamaResult {
  json: unknown;
  model: string;
}

export async function generateFoodJsonViaOllama(
  base64: string,
  host: string,
  model: string,
  timeoutMs = 300000
): Promise<OllamaResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${host.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          {
            role: "user",
            content: FOOD_PROMPT,
            images: [base64],
          },
        ],
        // num_gpu: 0 — полностью на CPU: на видеокартах с 4 ГБ VRAM
        // модель иначе не стартует (out-of-memory в CUDA)
        options: { temperature: 0.2, num_predict: 1024, num_ctx: 8192, num_gpu: 0 },
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      if (r.status === 404)
        throw new Error(`model_missing: скачайте модель: ollama pull ${model}`);
      throw new Error(`ollama_http_${r.status}`);
    }
    const data = (await r.json()) as { message?: { content?: string }; error?: string };
    if (data.error) throw new Error(`ollama: ${data.error}`);
    const text = data.message?.content?.trim() ?? "";
    if (!text) throw new Error("empty_response");
    return { json: JSON.parse(cleanJson(text)), model };
  } catch (e) {
    if (e instanceof TypeError)
      throw new Error("ollama_down: запустите Ollama (ollama serve)");
    if (e instanceof DOMException && e.name === "AbortError")
      throw new Error("ollama_timeout: модель думает дольше 5 минут");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
