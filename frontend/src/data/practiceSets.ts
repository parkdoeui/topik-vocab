import q51Set from "./writing-practice/q51-set-01.json";
import q52Set from "./writing-practice/q52-set-01.json";
import mixedSets from "./writing-practice/q53-q54-mixed-sets.json";

export interface PracticeBlankDefinition {
  marker: string;
  model_answer: string;
  accepted_variants: string[];
  focus: string;
  feedback: string;
}

export interface PracticeQuestionDefinition {
  id: string;
  question_number?: 51 | 52 | 53 | 54;
  prompt: string;
  blanks: PracticeBlankDefinition[];
}

export interface PracticeSetDefinition {
  id: string;
  title: string;
  question_type: string;
  target_seconds_per_question: number;
  description: string;
  accepted_variants_policy: string;
  questions: PracticeQuestionDefinition[];
}

export const practiceSets: PracticeSetDefinition[] = [q51Set, q52Set, ...mixedSets as PracticeSetDefinition[]];

export function getPracticeSet(id: string | undefined): PracticeSetDefinition | undefined {
  return practiceSets.find((set) => set.id === id);
}
