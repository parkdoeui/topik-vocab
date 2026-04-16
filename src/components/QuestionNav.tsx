interface QuestionNavProps {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function QuestionNav({
  current,
  total,
  onPrev,
  onNext,
}: QuestionNavProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <button
        type="button"
        onClick={onPrev}
        disabled={current <= 1}
        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ← Prev
      </button>

      <span className="text-sm text-gray-500">
        <span className="font-semibold text-gray-900">{current}</span>
        {" / "}
        {total}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={current >= total}
        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  );
}
