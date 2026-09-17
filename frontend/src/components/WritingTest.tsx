import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { writingTests } from "../data/tests";
import { finishWritingSession, transcribeImages } from "../services/api";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  saveWritingDraft,
  setSessionImages,
  type WritingImageEntry,
} from "../services/session";
import type { WritingQuestion } from "../types";

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Matches TranscriptionReview.countChars: whitespace is not counted.
function countChars(s: string): number {
  return s.replace(/\s/g, "").length;
}

const TYPE_LABELS: Record<string, string> = {
  "short-blank": "단문 쓰기",
  "chart-description": "도표 설명",
  "essay": "논설문",
};

const MAX_IMAGES_PER_LONG_QUESTION = 5;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function readImage(file: File): Promise<WritingImageEntry> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        reject(new Error("사진을 읽을 수 없습니다."));
        return;
      }
      resolve({ data: dataUrl.split(",")[1], mime_type: file.type });
    };
    reader.onerror = () => reject(new Error("사진을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

function UploadZone({
  disabled,
  images,
  onAdd,
  onError,
  onReadingChange,
  onRemove,
  questionNumber,
}: {
  disabled: boolean;
  images: WritingImageEntry[];
  onAdd: (entries: WritingImageEntry[]) => void;
  onError: (message: string) => void;
  onReadingChange: (reading: boolean) => void;
  onRemove: (index: number) => void;
  questionNumber: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const readingRef = useRef(false);
  const remaining = MAX_IMAGES_PER_LONG_QUESTION - images.length;

  const handleFiles = async (files: FileList | null) => {
    if (
      disabled ||
      readingRef.current ||
      !files ||
      files.length === 0 ||
      remaining <= 0
    ) return;

    const selected = Array.from(files).slice(0, remaining);
    const invalid = selected.find(
      (file) => !file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE_BYTES
    );
    if (invalid) {
      onError("10MB 이하의 이미지 파일만 추가할 수 있습니다.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    readingRef.current = true;
    onReadingChange(true);
    try {
      const entries = await Promise.all(selected.map(readImage));
      onAdd(entries);
      if (files.length > remaining) {
        onError(`최대 ${MAX_IMAGES_PER_LONG_QUESTION}장까지만 추가했습니다.`);
      }
    } catch {
      onError("사진을 읽을 수 없습니다. 다른 사진을 선택해 주세요.");
    } finally {
      readingRef.current = false;
      onReadingChange(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {images.map((image, index) => (
            <div key={`${image.data.slice(0, 24)}-${index}`} className="relative">
              <img
                src={`data:${image.mime_type};base64,${image.data}`}
                alt={`${questionNumber}번 답안 사진 ${index + 1}`}
                className="aspect-[4/3] w-full rounded-xl border border-gray-200 object-cover"
              />
              <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-xl text-red-600 shadow-sm disabled:opacity-50"
                aria-label={`${index + 1}번째 사진 삭제`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {remaining > 0 && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!disabled) void handleFiles(e.dataTransfer.files);
          }}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className={`w-full rounded-2xl border-2 border-dashed border-gray-300 px-6 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
              disabled
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:border-blue-400 active:bg-gray-50"
            } ${images.length > 0 ? "py-6" : "py-10"}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className={`mx-auto text-blue-500 ${images.length > 0 ? "h-10 w-10" : "h-16 w-16"}`}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
            <span className="mt-3 inline-block rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white">
              {images.length > 0 ? "사진 추가" : "클릭하여 업로드"}
            </span>
            <span className="mt-3 block text-sm text-gray-400">
              최대 {MAX_IMAGES_PER_LONG_QUESTION}장 · 선택한 순서대로 인식합니다
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={disabled}
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>
      )}

      {remaining === 0 && (
        <p className="text-center text-xs text-gray-400">
          사진 {MAX_IMAGES_PER_LONG_QUESTION}장을 모두 추가했습니다.
        </p>
      )}
    </div>
  );
}

export function WritingTest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const test = writingTests.find((t) => t.id === id);
  const sessionId = searchParams.get("session");

  const [qIdx, setQIdx] = useState(0);
  const [images, setImages] = useState<Record<number, WritingImageEntry[]>>({});
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [readingImages, setReadingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsedMs((p) => p + 1000), 1000);
    return () => clearInterval(interval);
  }, []);

  const addImages = useCallback((qNum: number, entries: WritingImageEntry[]) => {
    setImages((prev) => ({
      ...prev,
      [qNum]: [...(prev[qNum] ?? []), ...entries].slice(
        0,
        MAX_IMAGES_PER_LONG_QUESTION
      ),
    }));
  }, []);

  const removeImage = useCallback((qNum: number, index: number) => {
    setImages((prev) => ({
      ...prev,
      [qNum]: (prev[qNum] ?? []).filter((_, imageIndex) => imageIndex !== index),
    }));
  }, []);

  if (!test || !sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        {!test ? "시험을 찾을 수 없습니다." : "홈에서 새 시험을 시작해 주세요."}
      </div>
    );
  }

  const question = test.questions[qIdx];
  const isAnswered = (q: WritingQuestion) =>
    q.type === "short-blank"
      ? (texts[q.number] ?? "").trim().length > 0
      : (images[q.number] ?? []).length > 0;
  const allAnswered = test.questions.every(isAnswered);
  const timeLimitMs = test.time_limit_minutes * 60 * 1000;
  const remainingMs = Math.max(0, timeLimitMs - elapsedMs);

  async function handleSubmit() {
    if (!allAnswered || readingImages || !sessionId) return;
    setSubmitting(true);
    setError(null);

    try {
      const finished = await finishWritingSession(sessionId);
      if (!finished) {
        throw new Error("시험 종료 시간을 저장하지 못했습니다. 다시 시도해 주세요.");
      }

      const transcriptions: Record<number, string> = {};
      const charCounts: Record<number, number> = {};

      // Short-blank answers are typed directly — no OCR needed.
      for (const q of test!.questions) {
        if (q.type === "short-blank") {
          const text = (texts[q.number] ?? "").trim();
          transcriptions[q.number] = text;
          charCounts[q.number] = countChars(text);
        }
      }

      // Handwriting answers (chart / essay) are OCR'd via Gemini.
      const imageEntries = test!.questions
        .filter((q) => q.type !== "short-blank")
        .map((q) => ({ qNum: q.number, imgs: images[q.number] ?? [] }));

      const flatImages = imageEntries.flatMap((e) => e.imgs);
      if (flatImages.length > 0) {
        const results = await transcribeImages(flatImages);
        if (results.length !== flatImages.length) {
          throw new Error("사진 일부를 인식하지 못했습니다. 다시 시도해 주세요.");
        }
        let offset = 0;
        for (const e of imageEntries) {
          const slice = results.slice(offset, offset + e.imgs.length);
          transcriptions[e.qNum] = slice.map((r) => r.transcription).join("\n\n");
          charCounts[e.qNum] = slice.reduce((acc, r) => acc + r.char_count, 0);
          offset += e.imgs.length;
        }
      }

      // Images stay in memory (too large for localStorage); only the small
      // draft metadata is persisted so a refresh on the review page still works.
      setSessionImages(
        sessionId,
        Object.fromEntries(imageEntries.map((e) => [e.qNum, e.imgs]))
      );
      saveWritingDraft({
        id: sessionId,
        testId: test!.id,
        transcriptions,
        charCounts,
      });

      navigate(`/writing/${test!.id}/transcribe?session=${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 w-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">{test.title}</p>
          <p className="text-sm font-semibold text-gray-700">
            {qIdx + 1} / {test.questions.length}
          </p>
        </div>
        <div
          className={`text-sm font-mono font-semibold tabular-nums ${
            remainingMs === 0
              ? "text-red-600"
              : remainingMs < 5 * 60 * 1000
              ? "text-red-500"
              : "text-gray-700"
          }`}
        >
          {remainingMs === 0 ? "⏱ 시간 종료" : `${formatTime(remainingMs)} 남음`}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${((qIdx + 1) / test.questions.length) * 100}%` }}
        />
      </div>

      {remainingMs === 0 && (
        <p className="text-xs text-center text-amber-600">
          시험 시간이 종료되었습니다. 답안은 계속 작성하고 제출할 수 있습니다.
        </p>
      )}

      {/* Question card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">{question.number}번</span>
          <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
            {TYPE_LABELS[question.type] ?? question.type}
          </span>
          <span className="text-xs text-gray-400 ml-auto">{question.max_points}점</span>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">{question.instruction}</p>

        {question.image_url ? (
          <button
            type="button"
            onClick={() => setZoomSrc(`${import.meta.env.BASE_URL}${question.image_url}`)}
            className="block w-full"
          >
            <img
              src={`${import.meta.env.BASE_URL}${question.image_url}`}
              alt="문제 자료"
              className="w-full rounded-xl border border-gray-200"
            />
            <span className="mt-1.5 block text-xs text-gray-400">🔍 탭하여 크게 보기</span>
          </button>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-800 leading-loose whitespace-pre-line">
              {question.prompt}
            </p>
          </div>
        )}

        {(question.min_chars || question.max_chars) && (
          <p className="text-xs text-blue-600">
            {question.min_chars}–{question.max_chars}자
          </p>
        )}

        {question.type === "short-blank" ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">답안 입력</label>
              <span className="text-xs font-mono text-gray-400">
                {countChars(texts[question.number] ?? "")}자
              </span>
            </div>
            <textarea
              value={texts[question.number] ?? ""}
              onChange={(e) =>
                setTexts((prev) => ({ ...prev, [question.number]: e.target.value }))
              }
              rows={4}
              className="w-full text-sm text-gray-800 border border-gray-200 rounded-xl p-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={"㉠에 들어갈 문장을 쓰세요.\n㉡에 들어갈 문장을 쓰세요."}
            />
          </div>
        ) : (
          <UploadZone
            disabled={submitting || readingImages}
            images={images[question.number] ?? []}
            onAdd={(entries) => {
              setError(null);
              addImages(question.number, entries);
            }}
            onError={setError}
            onReadingChange={setReadingImages}
            onRemove={(index) => removeImage(question.number, index)}
            questionNumber={question.number}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {qIdx > 0 && (
          <button
            onClick={() => setQIdx((i) => i - 1)}
            disabled={submitting || readingImages}
            className="flex-1 py-3.5 rounded-xl border border-gray-200 text-base font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            이전
          </button>
        )}

        {qIdx < test.questions.length - 1 ? (
          <button
            onClick={() => setQIdx((i) => i + 1)}
            disabled={submitting || readingImages}
            className="flex-1 py-3.5 rounded-xl bg-gray-900 text-white text-base font-medium hover:bg-gray-800 active:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            다음
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting || readingImages}
            aria-busy={submitting || readingImages}
            className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 text-white text-base font-medium transition-colors"
          >
            {readingImages ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner />
                사진 불러오는 중…
              </span>
            ) : submitting ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner />
                답안 인식 중…
              </span>
            ) : (
              "제출하기"
            )}
          </button>
        )}
      </div>

      {/* Overview dots */}
      <div className="flex justify-center gap-2">
        {test.questions.map((q, i) => {
          const answered = isAnswered(q);
          return (
            <button
              key={q.number}
              onClick={() => setQIdx(i)}
              disabled={submitting || readingImages}
              aria-label={`${q.number}번 문제${answered ? ", 답변 완료" : ""}`}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === qIdx
                  ? "bg-blue-600"
                  : answered
                  ? "bg-green-400"
                  : "bg-gray-200"
              }`}
            />
          );
        })}
      </div>

      {!allAnswered && qIdx === test.questions.length - 1 && (
        <p className="text-xs text-center text-amber-600">
          모든 문제에 답안을 입력하거나 사진을 업로드해야 제출할 수 있습니다.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-center text-red-500">{error}</p>
      )}

      {/* Fullscreen image viewer (tap anywhere to close) */}
      {zoomSrc && (
        <div
          onClick={() => setZoomSrc(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <img
            src={zoomSrc}
            alt="문제 자료 확대"
            className="max-w-full max-h-full rounded-lg"
          />
          <button
            type="button"
            onClick={() => setZoomSrc(null)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/90 text-gray-800 text-2xl leading-none flex items-center justify-center"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
