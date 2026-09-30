import type { WritingImageEntry } from "./session";

const MAX_IMAGE_EDGE = 3200;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("사진을 읽을 수 없습니다."));
    image.src = url;
  });
}

function encodeJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("사진을 저장할 형식으로 변환하지 못했습니다."));
    }, "image/jpeg", 0.9);
  });
}

function readBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("사진을 읽을 수 없습니다."));
        return;
      }
      resolve(reader.result.split(",", 2)[1]);
    };
    reader.onerror = () => reject(new Error("사진을 읽을 수 없습니다."));
    reader.readAsDataURL(blob);
  });
}

function ensureVisible(canvas: HTMLCanvasElement): void {
  const sample = document.createElement("canvas");
  sample.width = sample.height = 64;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("사진을 확인할 수 없습니다.");
  context.drawImage(canvas, 0, 0, 64, 64);
  const pixels = context.getImageData(0, 0, 64, 64).data;
  const luminance: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    luminance.push((pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000);
  }
  luminance.sort((a, b) => a - b);
  if (luminance[Math.floor(luminance.length * 0.95)] < 12) {
    throw new Error("사진이 거의 검게 읽힙니다. 밝은 답안 사진을 다시 선택해 주세요.");
  }
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Encode the pixels that the browser preview displays into a standard JPEG. */
export async function prepareWritingImage(file: File): Promise<WritingImageEntry> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const edge = Math.max(image.naturalWidth, image.naturalHeight);
    if (!edge || edge > 20000 || image.naturalWidth * image.naturalHeight > 80_000_000) {
      throw new Error("사진 크기를 처리할 수 없습니다. 다른 사진을 선택해 주세요.");
    }
    const scale = Math.min(1, MAX_IMAGE_EDGE / edge);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진을 변환할 수 없습니다.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    ensureVisible(canvas);

    const blob = await encodeJpeg(canvas);
    if (blob.type !== "image/jpeg") {
      throw new Error("JPEG 사진으로 변환하지 못했습니다. 다른 사진을 선택해 주세요.");
    }
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error("변환한 사진이 10MB를 초과합니다. 다른 사진을 선택해 주세요.");
    }
    const [data, digest] = await Promise.all([
      readBase64(blob),
      crypto.subtle.digest("SHA-256", await blob.arrayBuffer()).then(hex),
    ]);
    return { id: crypto.randomUUID(), data, mime_type: "image/jpeg", sha256: digest };
  } finally {
    URL.revokeObjectURL(url);
  }
}
