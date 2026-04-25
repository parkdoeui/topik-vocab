import { useState } from "react";
import type { FlashcardEntry } from "../data/quizData";

interface FlashcardViewProps {
  cards: FlashcardEntry[];
}

export default function FlashcardView({ cards }: FlashcardViewProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = cards[index];

  const goTo = (next: number) => {
    setIndex(next);
    setFlipped(false);
  };

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4">
      {/* Progress */}
      <p className="text-sm text-gray-500">
        {index + 1} / {cards.length}
      </p>

      {/* Card */}
      <div
        onClick={() => setFlipped((v) => !v)}
        className="cursor-pointer w-full max-w-sm min-h-56 bg-white border border-gray-200 rounded-2xl shadow-md flex flex-col items-center justify-center px-8 py-10 select-none transition-all duration-150 hover:shadow-lg active:scale-[0.98]"
      >
        {!flipped ? (
          <div className="flex flex-col items-center gap-3">
            <span className="text-4xl font-bold text-gray-900">{card.korean}</span>
            <span className="text-xs text-gray-400 mt-2">tap to reveal</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full">
            <span className="text-3xl font-bold text-gray-900">{card.korean}</span>
            {card.english && (
              <span className="text-lg text-blue-700 font-medium text-center">
                {card.english}
              </span>
            )}
            {card.variations.length > 0 && (
              <div className="mt-1 w-full">
                <p className="text-xs text-gray-400 mb-1 text-center">Variations</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {card.variations.slice(0, 10).map((v) => (
                    <span
                      key={v}
                      className="bg-gray-100 text-gray-700 text-sm rounded-md px-2 py-0.5"
                    >
                      {v}
                    </span>
                  ))}
                  {card.variations.length > 10 && (
                    <span className="text-xs text-gray-400 self-center">
                      +{card.variations.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => goTo(Math.max(0, index - 1))}
          disabled={index === 0}
          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>
        <button
          onClick={() => goTo(Math.min(cards.length - 1, index + 1))}
          disabled={index === cards.length - 1}
          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / cards.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
