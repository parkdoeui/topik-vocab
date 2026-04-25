import { useState, useEffect, useCallback } from "react";
import type { FlashcardEntry } from "../data/quizData";

interface QuizViewProps {
  cards: FlashcardEntry[];
  onCleared: () => void;
}

interface Question {
  sentence: string;
  correctAnswer: string;
  choices: string[]; // 4 shuffled choices
  correctIndex: number;
}

function buildQuestion(cards: FlashcardEntry[]): Question {
  const keys = cards.map((_, i) => i);

  // Pick a random card for the question
  const qIdx = keys[Math.floor(Math.random() * keys.length)];
  const qCard = cards[qIdx];
  const qSentences = qCard.sentences;
  const { sentence, answer: correctAnswer } = qSentences[Math.floor(Math.random() * qSentences.length)];

  // Pick 3 distractor cards (different from qIdx)
  const otherKeys = keys.filter((k) => k !== qIdx);
  const shuffledOthers = [...otherKeys].sort(() => Math.random() - 0.5).slice(0, 3);
  const distractors = shuffledOthers.map((k) => {
    const dCard = cards[k];
    const dSentences = dCard.sentences;
    return dSentences[Math.floor(Math.random() * dSentences.length)].answer;
  });

  // Shuffle all 4 choices
  const allChoices = [correctAnswer, ...distractors];
  const shuffled = allChoices.sort(() => Math.random() - 0.5);
  const correctIndex = shuffled.indexOf(correctAnswer);

  return { sentence, correctAnswer, choices: shuffled, correctIndex };
}

function ConfettiPiece({ style }: { style: React.CSSProperties }) {
  return <div className="absolute w-2.5 h-2.5 rounded-sm" style={style} />;
}

const CONFETTI_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    key: i,
    style: {
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * -20}%`,
      backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      transform: `rotate(${Math.random() * 360}deg)`,
      animation: `confettiFall ${1.5 + Math.random() * 2}s ease-in ${Math.random() * 0.5}s forwards`,
    } as React.CSSProperties,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      {pieces.map((p) => (
        <ConfettiPiece key={p.key} style={p.style} />
      ))}
    </div>
  );
}

export default function QuizView({ cards, onCleared }: QuizViewProps) {
  const [streak, setStreak] = useState(0);
  const [question, setQuestion] = useState<Question>(() => buildQuestion(cards));
  const [selected, setSelected] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [cleared, setCleared] = useState(false);

  const nextQuestion = useCallback(() => {
    setQuestion(buildQuestion(cards));
    setSelected(null);
  }, [cards]);

  useEffect(() => {
    if (selected === null) return;
    const timer = setTimeout(() => {
      if (selected === question.correctIndex) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak >= 10) {
          setShowConfetti(true);
          setCleared(true);
          onCleared();
        } else {
          nextQuestion();
        }
      } else {
        setStreak((s) => Math.max(0, s - 1));
        nextQuestion();
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [selected, question.correctIndex, streak, nextQuestion, onCleared]);

  if (cleared) {
    return (
      <div className="flex flex-col items-center gap-6 py-16 px-4 text-center">
        {showConfetti && <Confetti />}
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900">Quiz Cleared!</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          You answered 10 in a row. This set is marked complete.
        </p>
        <button
          onClick={() => {
            setStreak(0);
            setCleared(false);
            setShowConfetti(false);
            setSelected(null);
            setQuestion(buildQuestion(cards));
          }}
          className="mt-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Practice Again
        </button>
      </div>
    );
  }

  const isAnswered = selected !== null;

  return (
    <div className="flex flex-col gap-6 py-8 px-4 max-w-md mx-auto">
      {/* Streak */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">Streak</span>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-sm transition-colors ${
                  i < streak ? "bg-blue-500" : "bg-gray-100"
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-semibold text-gray-700 ml-1">{streak}/10</span>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-8">
        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Fill in the blank</p>
        <p className="text-lg text-gray-900 font-medium leading-relaxed">{question.sentence}</p>
      </div>

      {/* Choices */}
      <div className="grid grid-cols-2 gap-3">
        {question.choices.map((choice, i) => {
          let bg = "bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50";
          if (isAnswered) {
            if (i === question.correctIndex) {
              bg = "bg-green-50 border-green-400 text-green-800";
            } else if (i === selected && i !== question.correctIndex) {
              bg = "bg-red-50 border-red-400 text-red-800";
            } else {
              bg = "bg-white border-gray-200 opacity-50";
            }
          }
          return (
            <button
              key={i}
              disabled={isAnswered}
              onClick={() => setSelected(i)}
              className={`border-2 rounded-xl px-4 py-3 text-sm font-medium text-left transition-all ${bg} disabled:cursor-not-allowed`}
            >
              <span className="text-xs text-gray-400 mr-1">{i + 1}.</span> {choice}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {isAnswered && (
        <p className={`text-center text-sm font-semibold ${selected === question.correctIndex ? "text-green-600" : "text-red-500"}`}>
          {selected === question.correctIndex ? "Correct!" : `Wrong — it was "${question.correctAnswer}"`}
        </p>
      )}
    </div>
  );
}
