export interface TopikQuestion {
  문제_번호: number;
  지시문: string;
  배점: string;
  문제_내용: string;
  선택지: Record<string, string>;
  정답: number;
  주제: string;
}

export interface TopikTest {
  id: string;
  title: string;
  level: "TOPIK I" | "TOPIK II";
  questions: TopikQuestion[];
}
