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

function UploadZone({
  question,
  images,
  onAdd,
  onRemove,
}: {
  question: WritingQuestion;
  images: WritingImageEntry[];
  onAdd: (entry: WritingImageEntry) => void;
  onRemove: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        onAdd({ data: base64, mime_type: file.type });
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer transition-colors"
      >
        <p className="text-sm text-gray-500">
          사진을 여기에 드래그하거나 <span className="text-blue-600 underline">클릭</span>하여 업로드
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {question.number === 53
            ? `200–300자 · 사진 1–3장`
            : `600–700자 · 사진 1–5장`}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, idx) => (
            <div key={idx} className="relative group">
              <img
                src={`data:${img.mime_type};base64,${img.data}`}
                alt={`답안 ${idx + 1}`}
                className="w-20 h-20 object-cover rounded-lg border border-gray-200"
              />
              <button
                onClick={() => onRemove(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WritingTest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const test = writingTests.find((t) => t.id === id);

  const [qIdx, setQIdx] = useState(0);
  const [images, setImages] = useState<Record<number, WritingImageEntry[]>>({});
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
  const allHaveImages = test.questions.every((q) => (images[q.number] ?? []).length > 0);
  const timeLimitMs = test.time_limit_minutes * 60 * 1000;
  const remainingMs = Math.max(0, timeLimitMs - elapsedMs);

  async function handleSubmit() {
    if (!allHaveImages) return;
    setSubmitting(true);
    setError(null);

    try {
      const entries = test!.questions.map((q) => ({
        qNum: q.number,
        imgs: images[q.number] ?? [],
      }));

      const flatImages = entries.flatMap((e) => e.imgs);
      const results = await transcribeImages(flatImages);

      let offset = 0;
      const transcriptions: Record<number, string> = {};
      const charCounts: Record<number, number> = {};

      for (const e of entries) {
        const slice = results.slice(offset, offset + e.imgs.length);
        transcriptions[e.qNum] = slice.map((r) => r.transcription).join("\n\n");
        charCounts[e.qNum] = slice.reduce((acc, r) => acc + r.char_count, 0);
        offset += e.imgs.length;
      }

      // Images stay in memory (too large for localStorage); only the small
      // draft metadata is persisted so a refresh on the review page still works.
      setSessionImages(
        sessionId.current,
        Object.fromEntries(entries.map((e) => [e.qNum, e.imgs]))
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

        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-800 leading-loose whitespace-pre-line">
            {question.prompt}
          </p>
        </div>

        {(question.min_chars || question.max_chars) && (
          <p className="text-xs text-blue-600">
            {question.min_chars}–{question.max_chars}자
          </p>
        )}

        <UploadZone
          question={question}
          images={images[question.number] ?? []}
          onAdd={(entry) => addImage(question.number, entry)}
          onRemove={(idx) => removeImage(question.number, idx)}
        />
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
            disabled={!allHaveImages || submitting}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium transition-colors"
          >
            {submitting ? "업로드 중…" : "제출하기"}
          </button>
        )}
      </div>

      {/* Overview dots */}
      <div className="flex justify-center gap-2">
        {test.questions.map((q, i) => {
          const hasImg = (images[q.number] ?? []).length > 0;
          return (
            <button
              key={q.number}
              onClick={() => setQIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === qIdx
                  ? "bg-blue-600"
                  : hasImg
                  ? "bg-green-400"
                  : "bg-gray-200"
              }`}
            />
          );
        })}
      </div>

      {!allHaveImages && qIdx === test.questions.length - 1 && (
        <p className="text-xs text-center text-amber-600">
          모든 문제에 사진을 업로드해야 제출할 수 있습니다.
        </p>
      )}

      {error && (
        <p className="text-xs text-center text-red-500">{error}</p>
      )}
    </div>
  );
}
