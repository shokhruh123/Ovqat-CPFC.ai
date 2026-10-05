"use client";

import type { FoodAnalysisResult } from "@/lib/types";

/**
 * fetch-обёртка в духе yolguard/frontend/app.js api():
 * никогда не бросает сырую ошибку в UI — возвращает {ok, data, error, status}.
 */
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

export const FRIENDLY = {
  OFFLINE: "Нет связи с сервером. Проверьте интернет и повторите.",
  TIMEOUT: "Gemini долго отвечает. Попробуйте фото поменьше или повторите.",
  RATE: "Превышен лимит запросов. Подождите минуту.",
} as const;

export async function analyzeFood(
  file: File,
  signal?: AbortSignal
): Promise<ApiResult<FoodAnalysisResult>> {
  const fd = new FormData();
  fd.append("image", file, file.name);
  try {
    const r = await fetch("/api/analyze-food", { method: "POST", body: fd, signal });
    let j: Record<string, unknown> | null = null;
    try {
      j = await r.json();
    } catch {
      j = null;
    }
    if (!r.ok) {
      const msg =
        (j && typeof j.error === "string" && j.error) ||
        (r.status === 429 ? FRIENDLY.RATE : `Ошибка сервера (${r.status})`);
      return { ok: false, status: r.status, data: null, error: msg };
    }
    return { ok: true, status: r.status, data: j as unknown as FoodAnalysisResult, error: null };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      return { ok: false, status: 0, data: null, error: FRIENDLY.TIMEOUT };
    if (e instanceof TypeError)
      return { ok: false, status: 0, data: null, error: FRIENDLY.OFFLINE };
    return { ok: false, status: 0, data: null, error: "Что-то пошло не так. Попробуйте ещё раз." };
  }
}
