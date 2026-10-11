import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getListeningAttempt, listeningOptionMarkers, listeningPracticeConfig, type ListeningAttemptReview, type ListeningPracticeType } from "../services/listeningApi";
import { ListeningAudioPlayer } from "./ListeningAudioPlayer";

export function ListeningPracticeReview({ practiceType = "43-44" }: { practiceType?: ListeningPracticeType }) {
  const { attemptId } = useParams<{ attemptId: string }>();
  return <ListeningReview key={`${practiceType}:${attemptId}`} attemptId={attemptId ?? ""} practiceType={practiceType} />;
}

function ListeningReview({ attemptId, practiceType }: { attemptId: string; practiceType: ListeningPracticeType }) {
  const config = listeningPracticeConfig[practiceType];
  const [attempt, setAttempt] = useState<ListeningAttemptReview | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void getListeningAttempt(attemptId).then((data) => {
      if (data.practice_type !== practiceType) throw new Error("Listening practice type mismatch");
      if (active) setAttempt(data);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attemptId, practiceType, reload]);
  if (!attempt && !failed) return <p className="py-16 text-center text-sm text-gray-400">듣기 결과를 불러오는 중…</p>;
  if (!attempt) return <div className="px-4 py-16 text-center text-sm text-gray-500 space-y-3"><p role="alert">듣기 결과를 불러오지 못했습니다.</p><button type="button" onClick={() => { setFailed(false); setReload((value) => value + 1); }} className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white">다시 시도</button><Link to={config.homePath} className="block text-blue-600 hover:underline">듣기 연습으로</Link></div>;
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-6">
      <header><Link to={config.homePath} className="text-xs font-medium text-blue-600 hover:underline">← {config.title}</Link><p className="mt-3 text-xs text-gray-400">{attempt.set_title}</p><h1 className="mt-2 text-2xl font-bold text-gray-900">듣기 연습 결과</h1><p className="mt-2 text-xs text-gray-400">자동 저장 완료 · {new Date(attempt.completed_at).toLocaleString("ko-KR")}</p></header>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center"><p className="text-sm text-gray-500">정답 수</p><p className="mt-1 text-4xl font-bold tabular-nums text-gray-900">{attempt.correct_count} / {attempt.question_count}</p><p className="mt-3 text-sm text-gray-500">풀이 중 전체 다시 재생 {attempt.replay_count}회 · 최초 재생 제외</p></section>
      <ListeningAudioPlayer audio={attempt.audio} />
      <section className="rounded-2xl border border-gray-200 bg-white p-5" aria-label="듣기 지문"><h2 className="font-bold text-gray-900">듣기 지문</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-loose text-gray-800">{attempt.passage}</p></section>
      <section className="space-y-4" aria-label="문항별 정답과 해설">
        <h2 className="font-bold text-gray-900">문항별 정답과 해설</h2>
        {attempt.questions.map((question) => (
          <article key={question.id} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-gray-900">{question.number}번 · {question.type}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${question.correct ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{question.correct ? "정답" : "오답"}</span></div>
            <p className="text-sm leading-relaxed text-gray-800">{question.prompt}</p>
            <ol className="space-y-2" aria-label={`${question.number}번 보기`}>{question.options.map((option, index) => (
              <li key={index} className={`rounded-xl border p-3 text-sm leading-relaxed ${index + 1 === question.correct_option ? "border-green-200 bg-green-50 text-green-900" : index + 1 === question.selected_option ? "border-red-200 bg-red-50 text-red-900" : "border-gray-100 text-gray-600"}`}>{listeningOptionMarkers[index]} {option}</li>
            ))}</ol>
            <p className="text-sm text-gray-700">내 답: {listeningOptionMarkers[question.selected_option - 1]} · 정답: {listeningOptionMarkers[question.correct_option - 1]}</p>
            <div className="rounded-xl bg-blue-50 p-4"><h4 className="text-sm font-semibold text-blue-900">정답 근거</h4><p className="mt-2 text-sm leading-relaxed text-blue-950">{question.explanation}</p></div>
          </article>
        ))}
      </section>
      <div className="grid grid-cols-2 gap-3 pb-4"><Link to={config.homePath} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">풀이 기록 보기</Link><Link to={`${config.homePath}/${attempt.set_id}`} className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-700">다시 풀기</Link></div>
    </div>
  );
}
