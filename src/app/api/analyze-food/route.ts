import { NextRequest, NextResponse } from "next/server";
import { generateFoodJson } from "@/lib/gemini";
import { generateFoodJsonViaQwen } from "@/lib/qwen";
import { generateFoodJsonViaOllama } from "@/lib/ollama";
import { UploadError, validateUpload } from "@/lib/image-validate";

export const runtime = "nodejs";
export const maxDuration = 300;

export type Provider = "ollama" | "qwen" | "gemini";

/** Активный движок: "ollama" (локальный Qwen, по умолчанию), "qwen" (HF), "gemini" (запасной). */
function activeProvider(): Provider {
  const v = (process.env.AI_PROVIDER || "ollama").trim().toLowerCase();
  return v === "gemini" || v === "qwen" ? v : "ollama";
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

  const engine = provider === "gemini" ? "Gemini" : provider === "qwen" ? "Qwen" : "Qwen локально";
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
    } else {
      const r = await generateFoodJsonViaOllama(
        base64,
        process.env.OLLAMA_HOST || "http://localhost:11434",
        process.env.OLLAMA_MODEL || "qwen3-vl:2b"
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
    if (/bad_token/i.test(msg))
      return NextResponse.json({ error: msg.replace(/^bad_token:\s*/, "") }, { status: 401 });
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
