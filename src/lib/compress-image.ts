/**
 * Сжатие изображения на клиенте через Canvas.
 * Критично для мобильных (Samsung / iPhone): фото с камеры 8–12 Мп
 * весит 4–10 МБ — жмём до max 1280px / ~0.7 JPEG перед отправкой.
 */
export async function compressImage(
  file: File,
  maxDim = 1280,
  quality = 0.72,
  mimeType = "image/jpeg"
): Promise<File> {
  // Маленькие файлы не трогаем
  if (file.size < 400 * 1024) return file;

  const bitmap = await createImageBitmap(file).catch(async () => {
    // Fallback для старых WebView: через <img>
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImg(url);
      return await bitmapFromImg(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  const { width, height } = bitmap as { width: number; height: number };
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  // Белый фон, чтобы прозрачный PNG не стал чёрным в JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  (bitmap as ImageBitmap).close?.();

  const blob: Blob | null = await new Promise((res) =>
    canvas.toBlob(res, mimeType, quality)
  );
  if (!blob) return file;

  const name = file.name.replace(/\.\w+$/, "") || "dish";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function bitmapFromImg(img: HTMLImageElement): Promise<ImageBitmap> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  // Эмулируем ImageBitmap минимальным интерфейсом
  return {
    width: canvas.width,
    height: canvas.height,
    close: () => {},
  } as unknown as ImageBitmap;
}
