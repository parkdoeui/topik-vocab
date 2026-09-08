import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { readingTests } from "../data/tests";
import type { StructuredQuestion } from "../types";
import { AnswerSheet } from "./AnswerSheet";
import { gradeStructured } from "../lib/grading";
import { saveSession, newSessionId } from "../services/session";
import { syncSession } from "../services/api";

export function ReadingTest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const test = readingTests.find((t) => t.id === id);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const sessionIdRef = useRef(newSessionId());
  const startedAtRef = useRef(new Date().toISOString());
  const questionEnteredAtRef = useRef(Date.now());

  const recordTiming = useCallback((questionNumber: number) => {
    const elapsed = Date.now() - questionEnteredAtRef.current;
    setTimings((prev) => ({
      ...prev,
      [String(questionNumber)]: (prev[String(questionNumber)] ?? 0) + elapsed,
    }));
  }, []);

  useEffect(() => {
    questionEnteredAtRef.current = Date.now();
  }, [questionIndex]);

  if (!test) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Test not found.
      </div>
    );
  }

  if (test.render_mode !== "structured") {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        PDF render mode coming soon.
      </div>
    );
  }

  const questions = test.questions;
  const question = questions[questionIndex];
  const totalAnswerable = questions.filter((q) => q.answer !== null).length;
  const answeredCount = Object.keys(answers).length;

  const handleSelect = (questionNum: number, choice: number) => {
    setAnswers((prev) => ({ ...prev, [String(questionNum)]: choice }));
  };

  const handleNavigate = (newIndex: number) => {
    recordTiming(question.문제_번호 ?? questionIndex + 1);
    setQuestionIndex(newIndex);
    questionEnteredAtRef.current = Date.now();
  };

  const handleSubmit = async () => {
    recordTiming(question.문제_번호 ?? questionIndex + 1);
    const finalTimings = { ...timings };
    const graded = gradeStructured(questions, answers, finalTimings);
    const now = new Date().toISOString();

    const session = {
      id: sessionIdRef.current,
      testId: test.id,
      section: "reading" as const,
      startedAt: startedAtRef.current,
      completedAt: now,
      totalTimeMs: Date.now() - new Date(startedAtRef.current).getTime(),
      answers: graded.answers,
      score: { correct: graded.correct, total: graded.total },
      syncStatus: "local-only" as const,
    };

    saveSession(session);
    navigate(`/reading-results/${sessionIdRef.current}`);

    // Background sync — don't block navigation
    syncSession(session).then((ok) => {
      if (ok) {
        saveSession({ ...session, syncStatus: "synced" });
      }
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0">
        <h1 className="text-sm font-semibold text-gray-900">{test.title}</h1>
        <span className="text-xs text-gray-500">
          {answeredCount}/{totalAnswerable} answered
        </span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Question panel */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <QuestionCard
            question={question}
            index={questionIndex}
            total={questions.length}
            selected={answers[String(question.number)] ?? null}
            onSelect={(choice) => handleSelect(question.number, choice)}
          />

          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={() => handleNavigate(Math.max(0, questionIndex - 1))}
              disabled={questionIndex === 0}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              ← Prev
            </button>
            {questionIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => handleNavigate(questionIndex + 1)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
              >
                Submit Test
              </button>
            )}
          </div>
        </div>

        {/* Answer sheet sidebar */}
        <div className="w-64 border-l border-gray-200 bg-white overflow-y-auto p-3 shrink-0 hidden md:block">
          <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
            Answer Sheet
          </div>
          <AnswerSheet
            totalQuestions={questions.length}
            answers={answers}
            onSelect={(num, choice) => {
              handleSelect(num, choice);
              setQuestionIndex(questions.findIndex((q) => q.number === num));
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="mt-4 w-full rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  total,
  selected,
  onSelect,
}: {
  question: StructuredQuestion;
  index: number;
  total: number;
  selected: number | null;
  onSelect: (choice: number) => void;
}) {
  if (question.answer === null) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <p className="text-xs text-gray-400 mb-2">
          문제 {question.number} / {total}
        </p>
        <p className="text-sm font-medium text-gray-600">{question.instruction}</p>
        <p className="mt-4 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
          ⚠ 저작권으로 인해 지문이 공개되지 않습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <p className="text-xs text-gray-400 mb-2">
        문제 {question.number} / {total}
        {question.topic && (
          <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
            {question.topic}
          </span>
        )}
      </p>
      <p className="text-sm font-medium text-gray-700 mb-3">{question.instruction}</p>
      {question.passage && (
        <div className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 mb-4 leading-relaxed whitespace-pre-wrap">
          {question.passage}
        </div>
      )}
      <div className="space-y-2">
        {Object.entries(question.choices).map(([key, value]) => {
          const choiceNum = parseInt(key);
          const isSelected = selected === choiceNum;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(choiceNum)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                isSelected
                  ? "border-blue-500 bg-blue-50 text-blue-900 font-medium"
                  : "border-gray-200 text-gray-800 hover:border-blue-300 hover:bg-blue-50/50"
              }`}
            >
              <span className="font-medium mr-2">
                {choiceNum === 1 ? "①" : choiceNum === 2 ? "②" : choiceNum === 3 ? "③" : "④"}
              </span>
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}
