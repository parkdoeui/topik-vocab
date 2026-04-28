import { useState, useRef } from "react";
import type { FlashcardEntry } from "../data/quizData";
import { gradeChallenge } from "../services/gemini";
import type { GradedWord } from "../services/gemini";

interface ChallengeViewProps {
  cards: FlashcardEntry[];
}

type Phase = "input" | "grading" | "results";

export default function ChallengeView({ cards }: ChallengeViewProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => Array(cards.length).fill(""));
  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState<GradedWord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const card = cards[currentIndex];
  const isLast = currentIndex === cards.length - 1;

  const handleNext = () => {
    const updated = [...answers];
    updated[currentIndex] = inputValue.trim();
    setAnswers(updated);

    if (isLast) {
      submitChallenge(updated);
    } else {
      setCurrentIndex((i) => i + 1);
      setInputValue(updated[currentIndex + 1] ?? "");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleNext();
  };

  const submitChallenge = async (finalAnswers: string[]) => {
    setPhase("grading");
    setError(null);
    const words = cards.map((c, i) => ({
      korean: c.korean,
      expectedEnglish: c.english,
      userAnswer: finalAnswers[i] ?? "",
    }));
    try {
      const graded = await gradeChallenge(words);
      setResults(graded);
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed.");
      setPhase("input");
      setCurrentIndex(cards.length - 1);
    }
  };

  const handleRestart = () => {
    setPhase("input");
    setCurrentIndex(0);
    setAnswers(Array(cards.length).fill(""));
    setInputValue("");
    setResults([]);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (phase === "grading") {
    return (
      <div className="flex flex-col items-center gap-6 py-20 px-4 text-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Gemini is grading your answers…</p>
      </div>
    );
  }

  if (phase === "results") {
    const correct = results.filter((r) => r.correct).length;
    const total = results.length;
    const pct = Math.round((correct / total) * 100);

    return (
      <div className="flex flex-col gap-4 py-4">
        {/* Score summary */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-5 text-center">
          <p className="text-4xl font-bold text-gray-900">{correct}/{total}</p>
          <p className="text-sm text-gray-500 mt-1">{pct}% correct</p>
        </div>

        {/* Results list */}
        <div className="flex flex-col gap-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex gap-3 items-start border rounded-xl px-4 py-3 ${
                r.correct
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <span className={`text-lg mt-0.5 ${r.correct ? "text-green-600" : "text-red-500"}`}>
                {r.correct ? "✓" : "✗"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{r.korean}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  You: <span className="text-gray-700">{r.userAnswer || "(blank)"}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{r.feedback}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleRestart}
          className="mt-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Input phase
  return (
    <div className="flex flex-col gap-6 py-6 px-1">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Word {currentIndex + 1} of {cards.length}</span>
        <div className="flex gap-0.5">
          {cards.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-4 rounded-full transition-colors ${
                i < currentIndex
                  ? "bg-blue-500"
                  : i === currentIndex
                  ? "bg-blue-300"
                  : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Word card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-10 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Type the meaning</p>
        <p className="text-3xl font-bold text-gray-900">{card.korean}</p>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type English meaning…"
          autoFocus
          className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={handleNext}
          className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          {isLast ? "Grade" : "Next"}
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">Press Enter or click Next to continue</p>
    </div>
  );
}
