import { useEffect, useState } from "react";
import { Link } from "react-router";
import { formatListeningTime, getListeningAttempts, getListeningSets, listeningPracticeConfig, type ListeningAttemptSummary, type ListeningPracticeType, type ListeningSetSummary } from "../services/listeningApi";

export function ListeningPracticeHome({ practiceType = "43-44" }: { practiceType?: ListeningPracticeType }) {
  return <ListeningHome key={practiceType} practiceType={practiceType} />;
}

function ListeningHome({ practiceType }: { practiceType: ListeningPracticeType }) {
  const config = listeningPracticeConfig[practiceType];
  const [sets, setSets] = useState<ListeningSetSummary[]>([]);
  const [attempts, setAttempts] = useState<ListeningAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [setsFailed, setSetsFailed] = useState(false);
  const [attemptsFailed, setAttemptsFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([getListeningSets(practiceType), getListeningAttempts(practiceType)]).then(([catalogue, history]) => {
      if (!active) return;
      if (catalogue.status === "fulfilled") setSets(catalogue.value);
      if (history.status === "fulfilled") setAttempts(history.value);
      setSetsFailed(catalogue.status === "rejected");
      setAttemptsFailed(history.status === "rejected");
      setLoading(false);
    });
    return () => { active = false; };
  }, [practiceType, reload]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-8">
      <header>
        <p className="mb-2 text-xs font-medium text-blue-600">TOPIK II · 듣기 {practiceType.replace("-", "–")}번 유형</p>
        <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">원하는 세트를 골라 두 문제를 풀어 보세요. 음성은 두 번 재생되며 전체 다시 듣기도 가능합니다. 제출하면 지문과 정답, 해설을 확인할 수 있습니다.</p>
        {sets[0] && <p className="mt-2 text-xs text-gray-400">{sets[0].notice}</p>}
      </header>
      {loading && <p className="py-8 text-center text-sm text-gray-400">듣기 세트를 불러오는 중…</p>}
      {setsFailed && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">듣기 세트를 불러오지 못했습니다. 아래 새로 고침으로 다시 시도해 주세요.</p>}
      <section className="space-y-3" aria-label="듣기 연습 세트">
        {sets.map((set) => (
          <article key={set.id} className="rounded-2xl border border-gray-200 bg-white p-5">
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{set.combination}</span>
            <h2 className="mt-3 font-semibold text-gray-900">{set.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">{set.topics.join(" · ")}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400">{set.question_count}문항 · 음성 {formatListeningTime(set.audio_duration_seconds)}</p>
              <Link to={`${config.homePath}/${set.id}`} className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">시작하기</Link>
            </div>
          </article>
        ))}
      </section>
      <section className="space-y-3" aria-label="저장된 듣기 풀이">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-gray-900">최근 풀이</h2>
          <button type="button" disabled={loading} onClick={() => { setLoading(true); setReload((value) => value + 1); }} className="text-xs font-medium text-blue-600 hover:underline disabled:text-gray-400">{loading ? "불러오는 중…" : "새로 고침"}</button>
        </div>
        {attemptsFailed ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">풀이 기록을 불러오지 못했습니다. 다시 시도해 주세요.</p>
          : !loading && attempts.length === 0 ? <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">아직 저장된 풀이가 없습니다. 첫 세트를 시작해 보세요.</p>
          : attempts.map((attempt) => (
            <Link key={attempt.id} to={`${config.reviewPath}/${attempt.id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-blue-200">
              <div className="flex items-start justify-between gap-3"><p className="font-medium text-gray-900">{attempt.set_title}</p><span className="shrink-0 text-sm font-semibold text-gray-700">{attempt.correct_count} / {attempt.question_count}문항 정답</span></div>
              <p className="mt-2 text-xs text-gray-500">{new Date(attempt.completed_at).toLocaleString("ko-KR")} · 전체 다시 재생 {attempt.replay_count}회</p>
            </Link>
          ))}
      </section>
    </div>
  );
}
