import type { DictionaryResult } from "../types";

interface WordTooltipProps {
  result: DictionaryResult | null;
  loading: boolean;
  visible: boolean;
}

export default function WordTooltip({ result, loading, visible }: WordTooltipProps) {
  if (!visible) return null;

  return (
    <span
      role="tooltip"
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 pointer-events-none"
    >
      <span className="block min-w-[200px] bg-white text-gray-900 text-base rounded-xl px-4 py-2.5 shadow-lg border border-gray-200 leading-snug">
        {loading ? (
          <span className="opacity-60">…</span>
        ) : result ? (
          <span className="flex flex-col gap-0.5">
            <span>
              <span className="font-semibold">{result.root ?? result.korean}</span>
              {result.root && result.root !== result.korean && (
                <span className="text-gray-400 ml-1.5">| {result.korean}</span>
              )}
            </span>
            <span className="text-gray-600">{result.english}</span>
            {result.partOfSpeech && (
              <span className="text-gray-400 text-sm">
                {result.partOfSpeech}
              </span>
            )}
          </span>
        ) : (
          <span className="opacity-60">not found</span>
        )}
        {/* Arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-200" />
      </span>
    </span>
  );
}
