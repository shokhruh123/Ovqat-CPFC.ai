import { NextRequest, NextResponse } from "next/server";
import { generateFoodJson } from "@/lib/gemini";
import { generateFoodJsonViaQwen } from "@/lib/qwen";
import { UploadError, validateUpload } from "@/lib/image-validate";

export const runtime = "nodejs";
export const maxDuration = 90;

/** Активный движок: "qwen" (по умолчанию) или "gemini" (код оставлен, выключен). */
function activeProvider(): "qwen" | "gemini" {
  return (process.env.AI_PROVIDER || "qwen").trim().toLowerCase() === "gemini"
    ? "gemini"
    : "qwen";
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
  } else {
    const hfToken = (process.env.HF_TOKEN || "").trim();
    if (!hfToken) {
      return NextResponse.json(
        { error: "HF_TOKEN не настроен. Создайте бесплатный токен: huggingface.co → Settings → Access Tokens → New token." },
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

  const engine = provider === "gemini" ? "Gemini" : "Qwen";
  try {
    const { json, model } =
      provider === "gemini"
        ? await generateFoodJson((process.env.GEMINI_API_KEY || "").trim(), base64, mime)
        : await generateFoodJsonViaQwen((process.env.HF_TOKEN || "").trim(), base64, mime);
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
