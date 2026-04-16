import type { TopikTest, TopikQuestion } from "../types";

// Legacy single-file tests (pending folder migration)
import test91Raw from "./reading/91.json";

// Auto-discover chunk files from folder-based tests: reading/<testNum>/<range>.json
const chunkModules = import.meta.glob("./reading/*/*.json", {
  eager: true,
  import: "default",
}) as Record<string, TopikQuestion[]>;

// Add one entry here when adding a new test folder
const TEST_METADATA: Record<
  number,
  { id: string; title: string; level: TopikTest["level"] }
> = {
  35: { id: "topik2-35", title: "제35회 TOPIK II 읽기", level: "TOPIK II" },
};

function buildFolderTests(): TopikTest[] {
  const grouped = new Map<
    number,
    Array<{ startNum: number; questions: TopikQuestion[] }>
  >();

  for (const [path, questions] of Object.entries(chunkModules)) {
    // e.g. "./reading/35/11-20.json"
    const match = path.match(/\.\/reading\/(\d+)\/(\d+)/);
    if (!match) continue;
    const testNum = parseInt(match[1], 10);
    const startNum = parseInt(match[2], 10);
    if (!grouped.has(testNum)) grouped.set(testNum, []);
    grouped.get(testNum)!.push({ startNum, questions });
  }

  return Array.from(grouped.entries())
    .filter(([testNum]) => testNum in TEST_METADATA)
    .map(([testNum, chunks]) => {
      chunks.sort((a, b) => a.startNum - b.startNum);
      return {
        ...TEST_METADATA[testNum],
        questions: chunks.flatMap((c) => c.questions),
      };
    });
}

const legacyTests: TopikTest[] = [
  {
    id: "topik2-91",
    title: "제91회 TOPIK II 읽기",
    level: "TOPIK II",
    questions: test91Raw as TopikQuestion[],
  },
];

export const tests: TopikTest[] = [
  ...buildFolderTests(),
  ...legacyTests,
].sort((a, b) => {
  const aNum = parseInt(a.id.split("-").pop() ?? "0", 10);
  const bNum = parseInt(b.id.split("-").pop() ?? "0", 10);
  return bNum - aNum;
});
