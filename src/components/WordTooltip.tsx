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
      <span className="block min-w-[200px] bg-gray-900 text-white text-base rounded-xl px-4 py-2.5 shadow-lg leading-snug">
        {loading ? (
          <span className="opacity-60">…</span>
        ) : result ? (
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">{result.root ?? result.korean}</span>
            <span className="opacity-80">{result.english}</span>
            {result.partOfSpeech && (
              <span className="opacity-50 text-sm">
                {result.partOfSpeech}
              </span>
            )}
          </span>
        ) : (
          <span className="opacity-60">not found</span>
        )}
        {/* Arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
