"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Images,
  ScanLine,
  RotateCcw,
  Sparkles,
  CloudUpload,
  History as HistoryIcon,
  Trash2,
  ChevronRight,
  Salad,
  CircleCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResultSheet } from "@/components/ResultSheet";
import { ToastStack, useToasts } from "@/components/Toast";
import { analyzeFood } from "@/lib/api-client";
import { compressImage } from "@/lib/compress-image";
import type { FoodAnalysisResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Stage = "idle" | "preview" | "loading" | "done";
type Tab = "scan" | "history";

interface HistoryItem extends FoodAnalysisResult {
  id: string;
  date: string;
}

function loadHistory(): HistoryItem[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("kbju-history");
    return raw ? (JSON.parse(raw).slice(0, 20) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("scan");
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    () => typeof navigator === "undefined" || navigator.onLine
  );
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { items: toasts, push } = useToasts();

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const pickFile = useCallback(
    async (f: File | undefined | null) => {
      setResult(null);
      if (!f) return;
      if (!f.type.startsWith("image/")) {
        push("Выберите изображение (JPG / PNG / WebP).", "err");
        return;
      }
      try {
        const compressed = await compressImage(f);
        setFile(compressed);
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(compressed);
        });
        setStage("preview");
        setTab("scan");
      } catch {
        push("Не удалось прочитать фото. Попробуйте другое.", "err");
      }
    },
    [push]
  );

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    pickFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const analyze = useCallback(async () => {
    if (!file || busy) return;
    if (!navigator.onLine) {
      push("Нет связи с сервером. Проверьте интернет и повторите.", "err");
      return;
    }
    setBusy(true);
    setStage("loading");
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 280000);

    const res = await analyzeFood(file, ctrl.signal);
    clearTimeout(timer);
    setBusy(false);

    if (!res.ok) {
      setStage("preview");
      push(res.error ?? "Ошибка анализа.", "err");
      return;
    }
    const r = res.data!;
    setResult(r);
    setStage("done");
    if (r.is_food) {
      const item: HistoryItem = {
        ...r,
        id: `${Date.now()}`,
        date: new Date().toLocaleString("ru-RU", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setHistory((h) => {
        const next = [item, ...h].slice(0, 20);
        try {
          localStorage.setItem("kbju-history", JSON.stringify(next));
        } catch {}
        return next;
      });
      push(`Готово: ${r.food_name} — ${r.calories} ккал`, "ok");
    } else {
      push("На фото не видно еды. Попробуйте другой ракурс.", "err");
    }
  }, [file, busy, push]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
    setFile(null);
    setPreview((o) => {
      if (o) URL.revokeObjectURL(o);
      return null;
    });
    setResult(null);
    setStage("idle");
  }, []);

  const openHistoryItem = (h: HistoryItem) => {
    setResult(h);
    setStage("done");
    setTab("scan");
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem("kbju-history");
    } catch {}
    push("История очищена.", "info");
  };

  const avg =
    history.length > 0
      ? Math.round(history.reduce((s, h) => s + h.calories, 0) / history.length)
      : 0;

  return (
    <div className="phone">
      <ToastStack items={toasts} />

      {/* Скрытые input'ы: камера отдельно, галерея отдельно (важно для Samsung/Android) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onInput}
        aria-label="Сфотографировать блюдо"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onInput}
        aria-label="Выбрать фото из галереи"
      />

      {/* Topbar: бренд + net-dot */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]/85 backdrop-blur-md">
        <div className="flex h-[62px] items-center justify-between px-[18px]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--accent)] shadow-[0_8px_20px_-8px_rgba(217,119,6,0.7)]">
              <Salad className="size-5 text-white" />
            </div>
            <div>
              <p className="font-display text-[17px] font-bold leading-none tracking-tight">
                Ovqat CPFC.ai
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">Gemini • калории по фото</p>
            </div>
          </div>
          <div
            role="status"
            aria-label={isOnline ? "Сервер на связи" : "Нет связи с сервером"}
            title={isOnline ? "На связи" : "Офлайн"}
            className={cn(
              "netdot flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              isOnline
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-red-500/10 text-red-600 dark:text-red-300"
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                isOnline ? "bg-emerald-500" : "bg-red-500",
                isOnline && "on"
              )}
            />
            {isOnline ? "online" : "offline"}
          </div>
        </div>
      </header>

      <main className="flex-1 px-[18px] pb-32 pt-2">
        {tab === "scan" && (
          <div key={stage} className="rise space-y-4">
            {stage === "idle" && (
              <>
                <div className="pb-1 pt-3">
                  <p className="kicker">Экспресс-анализ</p>
                  <h1 className="font-display mt-2 text-[26px] font-bold leading-[1.15] tracking-tight">
                    Сфоткай еду —<br />
                    узнай <span className="text-[var(--accent)]">КБЖУ</span>
                  </h1>
                  <p className="mt-2 max-w-[34ch] text-[15px] text-[var(--muted)]">
                    Камера или галерея на телефоне. Drag-and-drop на компьютере.
                  </p>
                </div>

                <Card
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickFile(e.dataTransfer.files?.[0]);
                  }}
                  onClick={() => galleryRef.current?.click()}
                  className={cn(
                    "spot relative cursor-pointer overflow-hidden border-2 border-dashed transition-all",
                    dragOver
                      ? "scale-[1.01] border-[var(--accent)] bg-[var(--accent)]/5"
                      : "hover:border-[var(--accent)]"
                  )}
                >
                  <CardContent className="p-8 text-center">
                    <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-[var(--accent)]/10">
                      <CloudUpload className="size-8 text-[var(--accent)]" />
                    </div>
                    <p className="font-display font-bold">Перетащите фото сюда</p>
                    <p className="mt-1 hidden text-sm text-[var(--muted)] md:block">
                      или нажмите, чтобы выбрать из проводника
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)] md:hidden">
                      или нажмите, чтобы открыть галерею
                    </p>
                    <p className="mt-3 text-[11px] text-[var(--faint)]">
                      JPG • PNG • WEBP — до 10 МБ
                    </p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    variant="primary"
                    size="lg"
                    className="h-16 flex-col gap-1 !text-[13px]"
                    onClick={() => cameraRef.current?.click()}
                  >
                    <Camera className="size-6" /> Сфотографировать
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="h-16 flex-col gap-1 !text-[13px]"
                    onClick={() => galleryRef.current?.click()}
                  >
                    <Images className="size-6" /> Из галереи
                  </Button>
                </div>

                <Card className="spot relative overflow-hidden">
                  <CardContent className="p-[18px]">
                    <h3 className="font-display mb-2 text-[15px] font-semibold">
                      Как это работает
                    </h3>
                    <ol className="space-y-2 text-sm text-[var(--muted)]">
                      {[
                        "Снимите блюдо — фото сожмётся прямо в браузере",
                        "Gemini определит блюдо, вес и КБЖУ",
                        "Получите вердикт и совет нутрициолога",
                      ].map((t, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-md bg-[var(--accent)]/15 text-[11px] font-bold text-[var(--accent)]">
                            {i + 1}
                          </span>
                          {t}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </>
            )}

            {stage === "preview" && preview && (
              <>
                <div className="pb-1 pt-3">
                  <p className="kicker">Проверка кадра</p>
                  <h2 className="font-display mt-2 text-[26px] font-bold tracking-tight">
                    Всё в кадре?
                  </h2>
                </div>
                <Card className="overflow-hidden">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="Превью блюда"
                      className="max-h-[52dvh] w-full object-cover"
                    />
                    <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-[11px] text-white backdrop-blur">
                      {(file!.size / 1024).toFixed(0)} КБ • сжато для отправки
                    </div>
                  </div>
                  <CardContent className="grid grid-cols-2 gap-2.5 p-4">
                    <Button
                      variant="outline"
                      className="h-12 rounded-2xl"
                      onClick={reset}
                    >
                      <RotateCcw /> Ещё раз
                    </Button>
                    <Button
                      variant="primary"
                      className="h-12 rounded-2xl"
                      busy={busy}
                      onClick={analyze}
                    >
                      <Sparkles /> Анализировать
                    </Button>
                  </CardContent>
                </Card>
                <div className="grid grid-cols-2 gap-2.5 md:hidden">
                  <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
                    <Camera /> Камера
                  </Button>
                  <Button variant="secondary" onClick={() => galleryRef.current?.click()}>
                    <Images /> Галерея
                  </Button>
                </div>
              </>
            )}

            {stage === "loading" && (
              <>
                <div className="pb-1 pt-3">
                  <p className="kicker">ИИ думает</p>
                  <h2 className="font-display mt-2 flex items-center gap-2 text-[26px] font-bold tracking-tight">
                    Сканируем блюдо
                    <span className="inline-flex gap-1" aria-hidden>
                      <i className="size-1.5 animate-bounce rounded-full bg-[var(--accent)]" />
                      <i
                        className="size-1.5 animate-bounce rounded-full bg-[var(--accent)]"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <i
                        className="size-1.5 animate-bounce rounded-full bg-[var(--accent)]"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </span>
                  </h2>
                </div>
                <Card className="overflow-hidden">
                  <div className="relative">
                    {preview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview}
                        alt="Сканирование"
                        className="max-h-[42dvh] w-full object-cover opacity-60"
                      />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30 backdrop-blur-[1px]">
                      <div className="relative">
                        <div className="size-16 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                        <ScanLine className="absolute inset-0 m-auto size-6 text-white" />
                      </div>
                      <p className="text-sm font-bold text-white">
                        ИИ сканирует блюдо…
                      </p>
                    </div>
                  </div>
                  <CardContent className="space-y-2.5 p-4" aria-hidden>
                    <div className="skel h-6 w-2/3" />
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="skel h-20" />
                      <div className="skel h-20" />
                      <div className="skel h-20" />
                    </div>
                    <div className="skel h-16 w-full" />
                  </CardContent>
                </Card>
                <Button variant="ghost" className="w-full" onClick={reset}>
                  Отменить
                </Button>
              </>
            )}

            {stage === "done" && preview && result && (
              <>
                <div className="pb-1 pt-3">
                  <p className="kicker flex items-center gap-1.5">
                    <CircleCheck className="size-3.5" /> Разобрано
                  </p>
                  <h2 className="font-display mt-2 text-[26px] font-bold tracking-tight">
                    {result.food_name}
                  </h2>
                </div>
                <Card className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Блюдо"
                    className="max-h-[36dvh] w-full object-cover"
                  />
                  <CardContent className="p-4">
                    <Button
                      variant="primary"
                      className="h-12 w-full rounded-2xl"
                      onClick={reset}
                    >
                      <RotateCcw /> Сканировать следующее
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="rise space-y-4">
            <div className="pb-1 pt-3">
              <p className="kicker">Дневник</p>
              <h2 className="font-display mt-2 text-[26px] font-bold tracking-tight">
                История анализов
              </h2>
            </div>

            {history.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-center">
                    <p className="font-display text-xl font-bold tabular-nums">
                      {history.length}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--faint)]">
                      записей
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-center">
                    <p className="font-display text-xl font-bold tabular-nums">{avg}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--faint)]">
                      ккал среднее
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-center">
                    <p className="font-display text-xl font-bold tabular-nums">
                      {history.reduce((s, h) => s + h.calories, 0)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--faint)]">
                      ккал всего
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => openHistoryItem(h)}
                      className="hist-row flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-left transition-colors hover:border-[var(--accent)]"
                    >
                      <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--accent)]/10">
                        <span className="font-display text-sm font-bold tabular-nums">
                          {h.calories}
                        </span>
                        <span className="text-[9px] text-[var(--faint)]">ккал</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{h.food_name}</p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {h.date} • {h.estimated_weight_g} г • {h.recommendation_verdict}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-[var(--faint)]" />
                    </button>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="mx-auto flex text-[var(--faint)] hover:text-red-500"
                  onClick={clearHistory}
                >
                  <Trash2 /> Очистить историю
                </Button>
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center p-8 text-center">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
                    <HistoryIcon className="size-8 text-[var(--faint)]" />
                  </div>
                  <p className="font-display font-bold">Пока пусто</p>
                  <p className="mt-1 max-w-[30ch] text-sm text-[var(--muted)]">
                    Сфотографируйте первое блюдо — разборы будут сохраняться здесь.
                  </p>
                  <Button
                    variant="primary"
                    className="mt-4"
                    onClick={() => setTab("scan")}
                  >
                    <Camera /> К сканеру
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      <footer className="hidden px-[18px] pb-6 text-center text-xs text-[var(--faint)] md:block">
        Фото сжимается в браузере • Ключ хранится в <code>GEMINI_API_KEY</code> на
        сервере
      </footer>

      {/* Таббар как в yolguard: Сканер / История */}
      <nav
        aria-label="Разделы"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur-md"
      >
        <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 gap-1 px-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2">
          <button
            role="tab"
            aria-selected={tab === "scan"}
            onClick={() => setTab("scan")}
            className={cn(
              "tabbtn relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-[13px] font-semibold",
              tab === "scan" ? "text-[var(--accent)]" : "text-[var(--faint)]"
            )}
          >
            <ScanLine className="size-4" /> Сканер
          </button>
          <button
            role="tab"
            aria-selected={tab === "history"}
            onClick={() => setTab("history")}
            className={cn(
              "tabbtn relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-[13px] font-semibold",
              tab === "history" ? "text-[var(--accent)]" : "text-[var(--faint)]"
            )}
          >
            <HistoryIcon className="size-4" /> История
            {history.length > 0 && (
              <span className="rounded-full bg-[var(--accent)]/15 px-1.5 text-[11px] font-bold text-[var(--accent)]">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {stage === "done" && result && preview && (
        <ResultSheet
          result={result}
          photoUrl={preview}
          onClose={() => setStage("preview")}
          onRetry={reset}
        />
      )}
    </div>
  );
}
