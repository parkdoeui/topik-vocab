// @vitest-environment jsdom
/// <reference types="node" />

import { createHash, webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareWritingImage } from "./writingImages";

class LoadedImage {
  naturalWidth = 4128;
  naturalHeight = 3096;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function mockBrowserImage(brightness: number, jpeg: Blob) {
  const pixels = new Uint8ClampedArray(64 * 64 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = pixels[i + 1] = pixels[i + 2] = brightness;
    pixels[i + 3] = 255;
  }
  const imageContext = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
  const sampleContext = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: pixels })) };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return (this.width === 64 ? sampleContext : imageContext) as unknown as CanvasRenderingContext2D;
  });
  const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(jpeg));
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("Image", LoadedImage);
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL });
  vi.stubGlobal("crypto", webcrypto);
  return { toBlob, revokeObjectURL, imageContext };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("prepareWritingImage", () => {
  it("uploads exactly the JPEG shown in the preview and hashes those bytes", async () => {
    const encoded = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
    const jpeg = new Blob([encoded], { type: "image/jpeg" });
    const { toBlob, revokeObjectURL, imageContext } = mockBrowserImage(210, jpeg);

    const prepared = await prepareWritingImage(new File(["original"], "answer.png", { type: "image/png" }));

    expect(prepared.mime_type).toBe("image/jpeg");
    expect(prepared.data).toBe(Buffer.from(encoded).toString("base64"));
    expect(prepared.sha256).toBe(createHash("sha256").update(encoded).digest("hex"));
    expect(imageContext.drawImage).toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("rejects an almost black decoded photo before OCR", async () => {
    const { toBlob, revokeObjectURL } = mockBrowserImage(5, new Blob());

    await expect(prepareWritingImage(new File(["photo"], "answer.jpg", { type: "image/jpeg" })))
      .rejects.toThrow("사진이 거의 검게 읽힙니다");

    expect(toBlob).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
