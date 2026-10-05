/**
 * Проверка загрузок по magic bytes — по образцу yolguard/backend/app/services/images.py.
 * Не доверяем имени файла и Content-Type от клиента: смотрим сигнатуру.
 */

export const MAX_BYTES = 10 * 1024 * 1024; // 10 МБ, как в yolguard

export class UploadError extends Error {}

type Sniffed = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: string };

function sniff(data: Uint8Array): Sniffed | "heic" | null {
  if (data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return { mime: "image/jpeg", ext: ".jpg" };
  if (
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 &&
    data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a
  )
    return { mime: "image/png", ext: ".png" };
  if (
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  )
    return { mime: "image/webp", ext: ".webp" };
  // iPhone: HEIC/HEIF-контейнер (ftyp heic/heix/hevc/mif1)
  const head = Buffer.from(data.slice(0, 32)).toString("ascii");
  if (head.includes("ftypheic") || head.includes("ftypheix") || head.includes("ftyphevc") || head.includes("ftypmif1"))
    return "heic";
  return null;
}

export interface ValidatedImage {
  bytes: Buffer;
  mime: Sniffed["mime"];
}

/** Валидирует байты фото. Бросает UploadError → 400 с понятным текстом. */
export function validateUpload(buf: Buffer): ValidatedImage {
  if (!buf || buf.length === 0) throw new UploadError("Пустой файл");
  if (buf.length > MAX_BYTES) throw new UploadError("Файл больше 10 МБ. Сожмите фото и попробуйте снова.");
  const kind = sniff(new Uint8Array(buf));
  if (kind === "heic") {
    throw new UploadError(
      "Это HEIC-фото с iPhone. Включите «Настройки → Камера → Форматы → Наиболее совместимый (JPEG)», либо выберите другое фото."
    );
  }
  if (kind === null) throw new UploadError("Только JPEG, PNG или WEBP. Файл не похож на фото.");
  return { bytes: buf, mime: kind.mime };
}
