import { NextRequest, NextResponse } from "next/server";
import { generateFoodJson } from "@/lib/gemini";
import { generateFoodJsonViaQwen } from "@/lib/qwen";
import { generateFoodJsonViaOllama } from "@/lib/ollama";
import { generateFoodJsonViaOpenRouter } from "@/lib/openrouter";
import { UploadError, validateUpload } from "@/lib/image-validate";

export const runtime = "nodejs";
export const maxDuration = 300;

export type Provider = "gemini" | "ollama" | "qwen" | "openrouter";

/** Активный движок: "gemini" (основной), остальные — запасные. */
function activeProvider(): Provider {
  const v = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  if (v === "ollama" || v === "qwen" || v === "openrouter") return v;
  return "gemini";
}

export async function POST(req: NextRequest) {
  const provider = activeProvider();

  if (provider === "gemini") {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY не настроен на сервере. Добавьте ключ в .env.local (https://aistudio.google.com/apikey)" },
        { status: 500 }
      );
    }
  } else if (provider === "qwen") {
    const hfToken = (process.env.HF_TOKEN || "").trim();
    if (!hfToken) {
      return NextResponse.json(
        { error: "HF_TOKEN не настроен. Создайте бесплатный токен: huggingface.co → Settings → Access Tokens → New token." },
        { status: 500 }
      );
    }
  }
  // ollama: ключей не нужно, нужен запущенный `ollama serve` + скачанная модель
  if (provider === "openrouter") {
    const key = (process.env.OPENROUTER_KEY || "").trim();
    if (!key) {
      return NextResponse.json(
        { error: "OPENROUTER_KEY не настроен. Бесплатный ключ: https://openrouter.ai/keys" },
        { status: 500 }
      );
    }
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    const v = formData.get("image");
    if (v instanceof File) file = v;
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать форму. Приложите фото." }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Фото не получено. Выберите изображение." }, { status: 400 });
  }

  // Серверная проверка по magic bytes (не верим Content-Type клиента)
  let mime = "image/jpeg";
  let base64: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const valid = validateUpload(buf);
    mime = valid.mime;
    base64 = valid.bytes.toString("base64");
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Не удалось прочитать фото." }, { status: 400 });
  }

  const engine =
    provider === "gemini" ? "Gemini" : provider === "openrouter" ? "OpenRouter" : provider === "qwen" ? "Qwen" : "Qwen локально";
  try {
    let json: unknown;
    let model: string;
    if (provider === "gemini") {
      const r = await generateFoodJson((process.env.GEMINI_API_KEY || "").trim(), base64, mime);
      json = r.json;
      model = r.model;
    } else if (provider === "qwen") {
      const r = await generateFoodJsonViaQwen((process.env.HF_TOKEN || "").trim(), base64, mime);
      json = r.json;
      model = r.model;
    } else if (provider === "openrouter") {
      const r = await generateFoodJsonViaOpenRouter(
        (process.env.OPENROUTER_KEY || "").trim(),
        (process.env.OPENROUTER_MODEL || "qwen/qwen2.5-vl-72b-instruct:free").trim(),
        base64,
        mime
      );
      json = r.json;
      model = r.model;
    } else {
      const r = await generateFoodJsonViaOllama(
        base64,
        process.env.OLLAMA_HOST || "http://localhost:11434",
        process.env.OLLAMA_MODEL || "qwen3-vl:2b-instruct"
      );
      json = r.json;
      model = r.model;
    }
    const p = json as Record<string, unknown>;
    if (typeof p?.is_food !== "boolean") {
      return NextResponse.json({ error: `${engine} вернул некорректный ответ. Попробуйте ещё раз.` }, { status: 502 });
    }
    return NextResponse.json({ ...p, _model: model, _provider: provider });
  } catch (e) {
    console.error("analyze-food:", e instanceof Error ? e.message : e);
    const msg = e instanceof Error ? e.message : "";
    if (/bad_token|no_credits/i.test(msg))
      return NextResponse.json(
        { error: msg.replace(/^(bad_token|no_credits):\s*/, "") },
        { status: /no_credits/i.test(msg) ? 402 : 401 }
      );
    if (/^(model_missing|ollama_down|ollama_timeout):/.test(msg))
      return NextResponse.json({ error: msg.replace(/^[a-z_]+:\s*/, "") }, { status: 503 });
    if (/429|quota|rate|лимит/i.test(msg))
      return NextResponse.json(
        { error: `Превышен лимит ${engine}. Подождите минуту и попробуйте снова.` },
        { status: 429 }
      );
    return NextResponse.json(
      { error: `${engine} не смог распознать блюдо. Проверьте соединение и попробуйте ещё раз.` },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/analyze-food", method: "POST(image: File)" });
}
