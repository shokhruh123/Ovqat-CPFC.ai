"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastItem {
  id: number;
  text: string;
  kind: "ok" | "err" | "info";
}

let nextId = 1;

/** Хук тостов в духе yolguard #toast: aria-live, автоскрытие 3.2с. */
export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string, kind: ToastItem["kind"] = "info") => {
    const id = nextId++;
    setItems((arr) => [...arr.slice(-2), { id, text, kind }]);
    setTimeout(() => setItems((arr) => arr.filter((t) => t.id !== id)), 3200);
  }, []);

  const toast = useCallback(
    (text: string) => push(text, "info"),
    [push]
  );

  return { items, push, toast };
}

export function ToastStack({ items }: { items: ToastItem[] }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[70] mx-auto flex w-full max-w-[420px] flex-col items-center gap-2 px-4 md:bottom-8"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "toast-in flex w-full items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-snug shadow-xl backdrop-blur",
            t.kind === "ok" &&
              "border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/95 dark:text-emerald-100",
            t.kind === "err" &&
              "border-red-200 bg-red-50/95 text-red-900 dark:border-red-900 dark:bg-red-950/95 dark:text-red-100",
            t.kind === "info" &&
              "border-stone-200 bg-white/95 text-stone-800 dark:border-stone-700 dark:bg-stone-900/95 dark:text-stone-100"
          )}
        >
          {t.kind === "ok" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : t.kind === "err" ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
