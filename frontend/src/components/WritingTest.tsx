import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { writingTests } from "../data/tests";
import { transcribeImages } from "../services/api";
import {
  newSessionId,
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

// Single-image upload (one photo per question). On mobile the whole zone is a
// large tap target; the remove button is always visible (no hover needed).
function UploadZone({
  image,
  onSet,
  onRemove,
}: {
  image: WritingImageEntry | undefined;
  onSet: (entry: WritingImageEntry) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0]; // limit to a single picture
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      onSet({ data: base64, mime_type: file.type });
    };
    reader.readAsDataURL(file);
  };

  if (image) {
    return (
      <div className="space-y-3">
        <img
          src={`data:${image.mime_type};base64,${image.data}`}
          alt="업로드한 답안"
          className="w-full rounded-xl border border-gray-200"
        />
        <button
          type="button"
          onClick={onRemove}
          className="w-full py-3.5 rounded-xl border border-red-200 text-red-600 text-base font-semibold hover:bg-red-50 active:bg-red-100 transition-colors"
        >
          🗑  사진 삭제
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
      }}
      className="border-2 border-dashed border-gray-300 hover:border-blue-400 active:bg-gray-50 rounded-2xl px-6 py-10 text-center cursor-pointer transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="mx-auto w-16 h-16 text-blue-500"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
      </svg>
      <div className="mt-4 inline-block rounded-xl bg-blue-600 text-white text-base font-semibold px-6 py-3">
        클릭하여 업로드
      </div>
      <p className="text-sm text-gray-400 mt-3">답안을 촬영하거나 사진 1장을 선택하세요</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

export function WritingTest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const test = writingTests.find((t) => t.id === id);

  const [qIdx, setQIdx] = useState(0);
  const [images, setImages] = useState<Record<number, WritingImageEntry[]>>({});
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const startedAt = useRef(new Date().toISOString());
  const sessionId = useRef(newSessionId());

  useEffect(() => {
    const interval = setInterval(() => setElapsedMs((p) => p + 1000), 1000);
    return () => clearInterval(interval);
  }, []);

  const addImage = useCallback(
    (qNum: number, entry: WritingImageEntry) => {
      setImages((prev) => ({
        ...prev,
        [qNum]: [...(prev[qNum] ?? []), entry],
      }));
    },
    []
  );

  const removeImage = useCallback((qNum: number, idx: number) => {
    setImages((prev) => {
      const updated = [...(prev[qNum] ?? [])];
      updated.splice(idx, 1);
      return { ...prev, [qNum]: updated };
    });
  }, []);

  if (!test) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        시험을 찾을 수 없습니다.
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
    if (!allAnswered) return;
    setSubmitting(true);
    setError(null);

    try {
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
        sessionId.current,
        Object.fromEntries(imageEntries.map((e) => [e.qNum, e.imgs]))
      );
      saveWritingDraft({
        id: sessionId.current,
        testId: test!.id,
        startedAt: startedAt.current,
        elapsedMs,
        transcriptions,
        charCounts,
      });

      navigate(`/writing/${test!.id}/transcribe?session=${sessionId.current}`);
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
            remainingMs < 5 * 60 * 1000 ? "text-red-500" : "text-gray-700"
          }`}
        >
          {formatTime(remainingMs)} 남음
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${((qIdx + 1) / test.questions.length) * 100}%` }}
        />
      </div>

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
          <img
            src={`${import.meta.env.BASE_URL}${question.image_url}`}
            alt="문제 자료"
            className="w-full rounded-xl border border-gray-200"
          />
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
            question={question}
            images={images[question.number] ?? []}
            onAdd={(entry) => addImage(question.number, entry)}
            onRemove={(idx) => removeImage(question.number, idx)}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {qIdx > 0 && (
          <button
            onClick={() => setQIdx((i) => i - 1)}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            이전
          </button>
        )}

        {qIdx < test.questions.length - 1 ? (
          <button
            onClick={() => setQIdx((i) => i + 1)}
            className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            다음
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium transition-colors"
          >
            {submitting ? "업로드 중…" : "제출하기"}
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
        <p className="text-xs text-center text-red-500">{error}</p>
      )}
    </div>
  );
}
