import q51Set from "./writing-practice/q51-set-01.json";
import q52Set from "./writing-practice/q52-set-01.json";

export interface PracticeBlankDefinition {
  marker: string;
  model_answer: string;
  accepted_variants: string[];
  focus: string;
  feedback: string;
}

export interface PracticeQuestionDefinition {
  id: string;
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

export const practiceSets: PracticeSetDefinition[] = [q51Set, q52Set];

export function getPracticeSet(id: string | undefined): PracticeSetDefinition | undefined {
  return practiceSets.find((set) => set.id === id);
}
