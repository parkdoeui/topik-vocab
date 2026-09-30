import { useEffect, useState } from "react";
import { fetchWritingImage } from "../services/api";

function exposureFor(image: HTMLImageElement): number {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return 1;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const brightness: number[] = [];
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 128) continue;
      brightness.push(Math.round(
        (pixels[index] * 299 + pixels[index + 1] * 587 + pixels[index + 2] * 114) / 1000
      ));
    }
    if (brightness.length === 0) return 1;
    brightness.sort((a, b) => a - b);
    const brightArea = brightness[Math.floor((brightness.length - 1) * 0.95)];
    return brightArea < 50
      ? Math.min(48, Math.round(210 / Math.max(brightArea, 4)))
      : 1;
  } catch {
    return 1;
  }
}

export function StoredWritingImage({
  path,
  alt,
  className,
  enhanceDark = false,
}: {
  path: string;
  alt: string;
  className?: string;
  enhanceDark?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [exposure, setExposure] = useState(1);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void fetchWritingImage(path).then((blob) => {
      if (cancelled) return;
      if (!blob || !blob.type.startsWith("image/")) {
        setFailed(true);
        return;
      }
      try {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        setFailed(true);
      }
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (failed) {
    return <div role="alert" className={`${className ?? ""} flex min-h-24 items-center justify-center p-3 text-center text-sm text-red-700`}>사진을 불러오지 못했습니다. 페이지를 새로고침해 주세요.</div>;
  }
  if (!src) {
    return <div role="status" className={`${className ?? ""} flex min-h-24 items-center justify-center p-3 text-center text-sm text-gray-500`}>사진 불러오는 중…</div>;
  }

  const image = (
    <img
      src={src}
      alt={alt}
      className={className}
      style={enhanceDark && exposure > 1 && !showOriginal ? { filter: `brightness(${exposure})` } : undefined}
      onLoad={(event) => {
        if (enhanceDark) setExposure(exposureFor(event.currentTarget));
      }}
      onError={() => setFailed(true)}
    />
  );
  if (!enhanceDark) return image;
  return (
    <figure className="m-0 space-y-2">
      {image}
      {exposure > 1 && (
        <figcaption className="flex flex-wrap items-center gap-2 text-xs text-amber-800">
          <span>저장된 사진이 어두워 밝게 표시했습니다.</span>
          <button type="button" onClick={() => setShowOriginal((current) => !current)} className="font-semibold underline">
            {showOriginal ? "밝게 보기" : "원본 보기"}
          </button>
        </figcaption>
      )}
    </figure>
  );
}
