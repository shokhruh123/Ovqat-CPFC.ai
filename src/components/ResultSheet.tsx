"use client";

import { useEffect } from "react";
import { X, Flame, Beef, Droplet, Wheat, Sparkles, TriangleAlert, House, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FoodAnalysisResult, FoodVariant } from "@/lib/types";
import { cn } from "@/lib/utils";

function verdictMeta(v: string) {
  if (v === "Рекомендуется")
    return { variant: "green" as const, icon: <Sparkles className="size-3.5" /> };
  if (v === "С осторожностью")
    return { variant: "yellow" as const, icon: <TriangleAlert className="size-3.5" /> };
  return { variant: "red" as const, icon: <X className="size-3.5" /> };
}

export function ResultSheet({
  result,
  photoUrl,
  onClose,
  onRetry,
}: {
  result: FoodAnalysisResult;
  photoUrl: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const v = verdictMeta(result.recommendation_verdict);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Результат анализа">
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-6">
        <div className="sheet-in pointer-events-auto mx-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] border border-[var(--line)] bg-[var(--surface)] shadow-2xl md:mx-0 md:max-w-lg md:rounded-[24px]">
          <div className="flex justify-center pb-1 pt-3 md:hidden" onClick={onClose}>
            <div className="h-1.5 w-12 rounded-full bg-[var(--line-2)]" />
          </div>

          <div className="relative h-48 w-full md:h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={result.food_name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70"
              aria-label="Закрыть результат"
            >
              <X className="size-4" />
            </button>
            <div className="absolute inset-x-4 bottom-3">
              <Badge variant={v.variant} className="mb-2 shadow">
                {v.icon}
                {result.recommendation_verdict}
              </Badge>
              <h2 className="font-display text-xl font-bold leading-tight text-white md:text-2xl">
                {result.food_name}
              </h2>
              <p className="text-sm text-white/80">≈ {result.estimated_weight_g} г порция</p>
            </div>
          </div>

          <div className="space-y-4 p-5 md:p-6">
            {!result.is_food ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                На фото не распознана еда. {result.short_advice}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 rounded-2xl bg-[var(--ink)] p-4 text-[var(--paper)]">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--accent)]">
                    <Flame className="size-6 text-white" />
                  </div>
                  <div>
                    <div className="font-display text-3xl font-bold leading-none tabular-nums">
                      {result.calories}{" "}
                      <span className="text-sm font-medium opacity-70">ккал</span>
                    </div>
                    <div className="mt-1 text-xs opacity-70">
                      на ≈ {result.estimated_weight_g} г
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <Macro
                    icon={<Beef className="size-4 text-sky-600 dark:text-sky-400" />}
                    label="Белки"
                    value={result.macronutrients.proteins_g}
                  />
                  <Macro
                    icon={<Droplet className="size-4 text-amber-600 dark:text-amber-400" />}
                    label="Жиры"
                    value={result.macronutrients.fats_g}
                  />
                  <Macro
                    icon={<Wheat className="size-4 text-emerald-600 dark:text-emerald-400" />}
                    label="Углеводы"
                    value={result.macronutrients.carbs_g}
                  />
                </div>

                {result.variants?.lean && result.variants?.rich && (
                  <VariantRange
                    lean={result.variants.lean}
                    rich={result.variants.rich}
                    estimate={result.calories}
                  />
                )}

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="size-3.5" /> Совет нутрициолога
                  </p>
                  <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-200">
                    {result.short_advice}
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-2.5 pb-[env(safe-area-inset-bottom)]">
              <Button variant="outline" className="h-12 flex-1 rounded-2xl" onClick={onRetry}>
                Ещё раз
              </Button>
              <Button variant="primary" className="h-12 flex-1 rounded-2xl" onClick={onClose}>
                Готово
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VariantRange({ lean, rich, estimate }: { lean: FoodVariant; rich: FoodVariant; estimate: number }) {
  const lo = Math.min(lean.calories, rich.calories);
  const hi = Math.max(lean.calories, rich.calories);
  const span = Math.max(1, hi - lo);
  const pos = Math.min(100, Math.max(0, ((estimate - lo) / span) * 100));
  const narrow = hi - lo < 50;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
        Вилка калорийности
      </p>
      <p className="mb-3 text-[11px] leading-snug text-[var(--faint)]">
        {narrow
          ? "Способ приготовления тут почти не влияет — разброс маленький."
          : "Одно блюдо, а калории разные: зависит от того, где и как готовили."}
      </p>

      {/* Шкала: lean — оценка — rich */}
      <div className="relative mx-1 mb-1 h-2 rounded-full bg-[var(--line)]">
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] bg-emerald-500"
          style={{ left: "0%" }}
          title={`${lean.label}: ${lean.calories} ккал`}
        />
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] bg-red-500"
          style={{ left: "100%" }}
          title={`${rich.label}: ${rich.calories} ккал`}
        />
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--accent)] bg-[var(--surface)] shadow"
          style={{ left: `${pos}%` }}
          title={`Оценка по фото: ${estimate} ккал`}
        />
      </div>
      <div className="mb-3 flex justify-between text-[11px] font-bold tabular-nums">
        <span className="text-emerald-600 dark:text-emerald-400">{lean.calories} ккал</span>
        <span className="text-[var(--faint)]">фото: {estimate}</span>
        <span className="text-red-600 dark:text-red-400">{rich.calories} ккал</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <House className="size-3.5" /> {lean.label}
          </p>
          <p className="font-display mt-1 text-lg font-bold tabular-nums">{lean.calories}</p>
          <p className="text-[11px] tabular-nums text-[var(--muted)]">
            Б {lean.macronutrients.proteins_g} • Ж {lean.macronutrients.fats_g} • У{" "}
            {lean.macronutrients.carbs_g}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{lean.note}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 dark:border-red-900 dark:bg-red-950/30">
          <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
            <Store className="size-3.5" /> {rich.label}
          </p>
          <p className="font-display mt-1 text-lg font-bold tabular-nums">{rich.calories}</p>
          <p className="text-[11px] tabular-nums text-[var(--muted)]">
            Б {rich.macronutrients.proteins_g} • Ж {rich.macronutrients.fats_g} • У{" "}
            {rich.macronutrients.carbs_g}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{rich.note}</p>
        </div>
      </div>
    </div>
  );
}

function Macro({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-center">
      <div className="mb-1 flex justify-center">{icon}</div>
      <div className="font-display text-lg font-bold leading-none tabular-nums">
        {value}
        <span className="ml-0.5 text-xs font-medium opacity-60">г</span>
      </div>
      <div className={cn("mt-1 text-[11px] text-[var(--muted)]")}>{label}</div>
    </div>
  );
}
