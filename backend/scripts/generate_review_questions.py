"""Generate the reviewed five-set TOPIK collocation question bank.

The sentences and distractors below are intentionally authored rather than randomly generated.
Running the script is deterministic and overwrites only the generated review JSON artifacts.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "language_review"

SETS = [
    {"id": "review-set-1", "title": "1세트 · 실제 오류 핵심", "description": "자주 틀린 조사와 자동사를 먼저 바로잡습니다.", "setPosition": 1},
    {"id": "review-set-2", "title": "2세트 · 결합 정확도", "description": "명사·조사·동사 결합을 문장 안에서 연습합니다.", "setPosition": 2},
    {"id": "review-set-3", "title": "3세트 · 문어체 표현", "description": "TOPIK 쓰기에서 자주 쓰는 문제 해결 표현을 익힙니다.", "setPosition": 3},
    {"id": "review-set-4", "title": "4세트 · 성과와 환경", "description": "논설문에 재사용하기 좋은 핵심 결합을 연습합니다.", "setPosition": 4},
    {"id": "review-set-5", "title": "5세트 · 종합 생산", "description": "원인·결과와 예방 표현을 직접 생산합니다.", "setPosition": 5},
]


def spec(
    pattern: str, category: str, source: str, explanation: str,
    examples: list[str], mistakes: list[str], items: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "pattern": pattern, "category": category, "source": source,
        "explanation": explanation, "correctExamples": examples,
        "commonMistakes": mistakes, "items": items,
    }


SPECS = [
    spec("N에 직면하다", "verb_collocation", "user_error", "직면하다는 대상과 조사 '에'를 결합한다.", ["문제에 직면하다", "위기에 직면하다", "어려움에 직면하다"], ["문제를 직면하다"], [
        {"type":"particle_choice","q":"현대 사회에서는 예상하지 못한 문제___ 직면할 수 있다.","o":["를","가","에","으로"],"a":"에","d":1},
        {"type":"natural_sentence","o":["지역 사회는 환경 문제를 직면하고 있다.","지역 사회는 환경 문제에 직면하고 있다.","지역 사회는 환경 문제가 직면하고 있다.","지역 사회는 환경 문제로 직면하고 있다."],"a":"지역 사회는 환경 문제에 직면하고 있다.","d":2},
        {"type":"error_correction","q":"많은 기업이 인력 부족 문제를 직면하고 있다.","a":"많은 기업이 인력 부족 문제에 직면하고 있다.","d":3},
        {"type":"collocation_completion","q":"예상하지 못한 위기에 ______","a":"직면하다","d":2},
        {"type":"particle_choice","q":"기업은 급격한 시장 변화로 인한 위기___ 직면했다.","o":["에","를","가","와"],"a":"에","d":1},
    ]),
    spec("N이/가 생기다", "particle", "user_error", "생기다는 자동사이므로 생기는 대상에 주격 조사 '이/가'를 쓴다.", ["자신감이 생기다", "관심이 생기다", "문제가 생기다"], ["자신감을 생기다", "문제들을 생기다"], [
        {"type":"natural_sentence","o":["새로운 경험을 하면 자신감을 생길 수 있다.","새로운 경험을 하면 자신감이 생길 수 있다.","새로운 경험을 하면 자신감에 생길 수 있다.","새로운 경험을 하면 자신감으로 생길 수 있다."],"a":"새로운 경험을 하면 자신감이 생길 수 있다.","d":2},
        {"type":"particle_choice","q":"창의적인 활동을 하면 자신감___ 생길 수 있다.","o":["을","이","에","으로"],"a":"이","d":1},
        {"type":"error_correction","q":"학생들은 발표 경험을 통해 자신감을 생길 수 있다.","a":"학생들은 발표 경험을 통해 자신감이 생길 수 있다.","d":3},
        {"type":"collocation_completion","q":"새로운 관심이 ______","a":"생기다","d":2},
        {"type":"natural_sentence","o":["작은 문제가 생기면 즉시 해결해야 한다.","작은 문제를 생기면 즉시 해결해야 한다.","작은 문제에 생기면 즉시 해결해야 한다.","작은 문제로 생기면 즉시 해결해야 한다."],"a":"작은 문제가 생기면 즉시 해결해야 한다.","d":2},
    ]),
    spec("N에 대한", "particle", "user_error", "'대한'은 앞말과 '에 대한'으로 결합한다.", ["변화에 대한 조사", "문제에 대한 해결책", "교육에 대한 관심"], ["변화의 대한", "문제를 대한"], [
        {"type":"particle_choice","q":"국내 캠핑 문화의 변화___ 대한 조사를 실시하였다.","o":["의","에","를","로"],"a":"에","d":1},
        {"type":"natural_sentence","o":["디지털 격차의 대한 해결 방안이 필요하다.","디지털 격차에 대한 해결 방안이 필요하다.","디지털 격차를 대한 해결 방안이 필요하다.","디지털 격차로 대한 해결 방안이 필요하다."],"a":"디지털 격차에 대한 해결 방안이 필요하다.","d":2},
        {"type":"error_correction","q":"환경 문제의 대한 관심을 높여야 한다.","a":"환경 문제에 대한 관심을 높여야 한다.","d":3},
        {"type":"collocation_completion","q":"청년 고용 문제___ 대한 정책","a":"에","d":2},
        {"type":"particle_choice","q":"연구진은 인구 변화___ 대한 보고서를 발표했다.","o":["에","의","가","로"],"a":"에","d":1},
    ]),
    spec("N이/가 활성화되다", "intransitive_transitive", "user_error", "어떤 모임이나 활동이 활발해진 결과는 '활성화되다'로 쓴다.", ["모임이 활성화되다", "지역 경제가 활성화되다", "교류가 활성화되다"], ["모임을 활성화되다"], [
        {"type":"natural_sentence","o":["온라인 모임을 활성화되면서 참여자가 늘었다.","온라인 모임이 활성화되면서 참여자가 늘었다.","온라인 모임에 활성화되면서 참여자가 늘었다.","온라인 모임으로 활성화되면서 참여자가 늘었다."],"a":"온라인 모임이 활성화되면서 참여자가 늘었다.","d":2},
        {"type":"particle_choice","q":"지역 축제___ 활성화되면 상권에도 활기가 생긴다.","o":["을","이","에","으로"],"a":"이","d":1},
        {"type":"error_correction","q":"지역 모임을 활성화되었다.","a":"지역 모임이 활성화되었다.","d":3},
        {"type":"collocation_completion","q":"지역 경제가 ______","a":"활성화되다","d":2},
        {"type":"natural_sentence","o":["주민 간 교류가 활성화될 필요가 있다.","주민 간 교류를 활성화될 필요가 있다.","주민 간 교류에 활성화될 필요가 있다.","주민 간 교류로 활성화될 필요가 있다."],"a":"주민 간 교류가 활성화될 필요가 있다.","d":2},
    ]),
    spec("N이/가 증가하다", "intransitive_transitive", "user_error", "증가하다는 자동사이므로 늘어나는 수량을 주어로 둔다.", ["참가자 수가 증가하다", "비율이 증가하다", "수요가 증가하다"], ["참가자들을 증가하다"], [
        {"type":"particle_choice","q":"마라톤 참가자 수___ 2배로 증가하였다.","o":["를","가","에","으로"],"a":"가","d":1},
        {"type":"natural_sentence","o":["1인 가구 비율을 크게 증가하였다.","1인 가구 비율이 크게 증가하였다.","1인 가구 비율에 크게 증가하였다.","1인 가구 비율로 크게 증가하였다."],"a":"1인 가구 비율이 크게 증가하였다.","d":2},
        {"type":"error_correction","q":"온라인 이용자들을 지난해보다 증가했다.","a":"온라인 이용자 수가 지난해보다 증가했다.","d":3},
        {"type":"collocation_completion","q":"청년층의 참여 비율이 ______","a":"증가하다","d":2},
        {"type":"particle_choice","q":"친환경 제품에 대한 수요___ 꾸준히 증가하고 있다.","o":["을","이","에","로"],"a":"이","d":1},
    ]),
    spec("N의 필요성을 느끼다", "noun_verb_collocation", "user_error", "필요성의 대상은 'N의 필요성'으로 만들고 '느끼다'와 결합한다.", ["창의력의 필요성을 느끼다", "교육의 필요성을 느끼다", "예방의 필요성을 느끼다"], ["창의력이 필요성을 느끼다"], [
        {"type":"natural_sentence","o":["많은 사람이 안전 교육이 필요성을 느낀다.","많은 사람이 안전 교육의 필요성을 느낀다.","많은 사람이 안전 교육을 필요성을 느낀다.","많은 사람이 안전 교육에 필요성을 느낀다."],"a":"많은 사람이 안전 교육의 필요성을 느낀다.","d":2},
        {"type":"particle_choice","q":"정기 검진___ 필요성을 널리 알릴 필요가 있다.","o":["이","의","을","에"],"a":"의","d":1},
        {"type":"error_correction","q":"정부는 환경 보호가 필요성을 느껴 관련 제도를 마련했다.","a":"정부는 환경 보호의 필요성을 느껴 관련 제도를 마련했다.","d":3},
        {"type":"collocation_completion","q":"예방의 필요성을 ______","a":"느끼다","d":2},
        {"type":"natural_sentence","o":["학생들은 진로 상담의 필요성을 느낄 수 있다.","학생들은 진로 상담이 필요성을 느낄 수 있다.","학생들은 진로 상담을 필요성을 느낄 수 있다.","학생들은 진로 상담에 필요성을 느낄 수 있다."],"a":"학생들은 진로 상담의 필요성을 느낄 수 있다.","d":2},
    ]),
    spec("N을/를 발휘하다", "noun_verb_collocation", "user_error", "창의력·능력·전문성은 목적어로 두고 '발휘하다'와 결합한다.", ["창의력을 발휘하다", "능력을 발휘하다", "전문성을 발휘하다"], ["창의력이 발휘하다", "창의력을 행사시키다"], [
        {"type":"particle_choice","q":"학생들은 프로젝트에서 창의력___ 발휘할 수 있다.","o":["이","을","에","으로"],"a":"을","d":1},
        {"type":"natural_sentence","o":["구성원은 각자의 전문성이 발휘해야 한다.","구성원은 각자의 전문성을 발휘해야 한다.","구성원은 각자의 전문성에 발휘해야 한다.","구성원은 각자의 전문성으로 발휘해야 한다."],"a":"구성원은 각자의 전문성을 발휘해야 한다.","d":2},
        {"type":"error_correction","q":"개인의 능력이 발휘하여 문제를 해결할 수 있다.","a":"개인이 능력을 발휘하여 문제를 해결할 수 있다.","d":3},
        {"type":"collocation_completion","q":"리더십을 ______","a":"발휘하다","d":2},
        {"type":"particle_choice","q":"위기 상황에서는 문제 해결 능력___ 발휘해야 한다.","o":["이","을","에","로"],"a":"을","d":1},
    ]),
    spec("N에 지장을 주다", "verb_collocation", "user_error", "생활·업무·건강에 부정적 방해를 준다는 뜻은 '지장을 주다'를 쓴다.", ["직장 생활에 지장을 주다", "건강에 지장을 주다", "학습에 지장을 주다"], ["직장 생활에 침해되다"], [
        {"type":"natural_sentence","o":["소음은 학습 환경을 지장을 줄 수 있다.","소음은 학습 환경에 지장을 줄 수 있다.","소음은 학습 환경이 지장을 줄 수 있다.","소음은 학습 환경으로 지장을 줄 수 있다."],"a":"소음은 학습 환경에 지장을 줄 수 있다.","d":2},
        {"type":"particle_choice","q":"과도한 업무는 건강___ 지장을 줄 수 있다.","o":["을","이","에","으로"],"a":"에","d":1},
        {"type":"error_correction","q":"공사 소음이 주민의 일상생활을 지장을 주고 있다.","a":"공사 소음이 주민의 일상생활에 지장을 주고 있다.","d":3},
        {"type":"collocation_completion","q":"업무에 지장을 ______","a":"주다","d":2},
        {"type":"natural_sentence","o":["지나친 스트레스는 건강에 지장을 준다.","지나친 스트레스는 건강을 지장을 준다.","지나친 스트레스는 건강이 지장을 준다.","지나친 스트레스는 건강으로 지장을 준다."],"a":"지나친 스트레스는 건강에 지장을 준다.","d":2},
    ]),
    spec("N을/를 받을 경우", "particle", "user_error", "받다의 대상에는 목적격 조사 '을/를'을 쓰며 '경우' 뒤에 조사를 덧붙이지 않는다.", ["문자를 받을 경우", "전화를 받을 경우", "안내를 받을 경우"], ["문자 받을 경우의"], [
        {"type":"particle_choice","q":"의심스러운 문자___ 받을 경우 즉시 확인해야 한다.","o":["가","를","에","로"],"a":"를","d":1},
        {"type":"natural_sentence","o":["낯선 전화를 받을 경우에는 개인정보를 주지 말아야 한다.","낯선 전화가 받을 경우에는 개인정보를 주지 말아야 한다.","낯선 전화에 받을 경우에는 개인정보를 주지 말아야 한다.","낯선 전화로 받을 경우에는 개인정보를 주지 말아야 한다."],"a":"낯선 전화를 받을 경우에는 개인정보를 주지 말아야 한다.","d":2},
        {"type":"error_correction","q":"의심스러운 문자를 받을 경우의 즉시 삭제해야 한다.","a":"의심스러운 문자를 받을 경우 즉시 삭제해야 한다.","d":3},
        {"type":"collocation_completion","q":"안내 문자를 ______ 경우","a":"받다","d":2},
        {"type":"particle_choice","q":"피해 사실___ 통보받았을 때 관련 기관에 연락해야 한다.","o":["을","이","에","로"],"a":"을","d":1},
    ]),
    spec("N을/를 느끼다", "noun_verb_collocation", "user_error", "소외감·부담감·필요성처럼 마음속 상태는 목적어로 두고 '느끼다'와 결합한다.", ["소외감을 느끼다", "부담감을 느끼다", "필요성을 느끼다"], ["소외감 느끼다"], [
        {"type":"natural_sentence","o":["노인들은 디지털 환경에서 소외감 느낄 수 있다.","노인들은 디지털 환경에서 소외감을 느낄 수 있다.","노인들은 디지털 환경에서 소외감이 느낄 수 있다.","노인들은 디지털 환경에서 소외감에 느낄 수 있다."],"a":"노인들은 디지털 환경에서 소외감을 느낄 수 있다.","d":2},
        {"type":"particle_choice","q":"학생들은 진로 선택 과정에서 부담감___ 느낄 수 있다.","o":["이","을","에","으로"],"a":"을","d":1},
        {"type":"error_correction","q":"일부 주민은 정책 변화로 불안감 느끼고 있다.","a":"일부 주민은 정책 변화로 불안감을 느끼고 있다.","d":3},
        {"type":"collocation_completion","q":"심리적 부담을 ______","a":"느끼다","d":2},
        {"type":"natural_sentence","o":["학생들은 학습 과정에서 성취감을 느낄 수 있다.","학생들은 학습 과정에서 성취감이 느낄 수 있다.","학생들은 학습 과정에서 성취감에 느낄 수 있다.","학생들은 학습 과정에서 성취감으로 느낄 수 있다."],"a":"학생들은 학습 과정에서 성취감을 느낄 수 있다.","d":2},
    ]),
    spec("N에 영향을 미치다", "verb_collocation", "general_topik", "영향이 미치는 대상에는 조사 '에'를 쓴다.", ["건강에 영향을 미치다", "사회에 영향을 미치다", "학습 태도에 영향을 미치다"], ["건강을 영향을 미치다"], [
        {"type":"particle_choice","q":"수면 부족은 집중력___ 영향을 미칠 수 있다.","o":["을","이","에","으로"],"a":"에","d":1},
        {"type":"natural_sentence","o":["미디어는 청소년의 가치관에 영향을 미친다.","미디어는 청소년의 가치관을 영향을 미친다.","미디어는 청소년의 가치관이 영향을 미친다.","미디어는 청소년의 가치관으로 영향을 미친다."],"a":"미디어는 청소년의 가치관에 영향을 미친다.","d":2},
        {"type":"error_correction","q":"기후 변화는 농업 생산을 큰 영향을 미치고 있다.","a":"기후 변화는 농업 생산에 큰 영향을 미치고 있다.","d":3},
        {"type":"collocation_completion","q":"사회에 영향을 ______","a":"미치다","d":2},
        {"type":"particle_choice","q":"부모의 태도는 자녀의 학습 습관___ 영향을 준다.","o":["에","을","이","로"],"a":"에","d":1},
    ]),
    spec("N을/를 해결하다", "noun_verb_collocation", "general_topik", "문제·갈등·과제를 목적어로 두고 '해결하다'와 결합한다.", ["문제를 해결하다", "갈등을 해결하다", "과제를 해결하다"], ["문제에 해결하다"], [
        {"type":"natural_sentence","o":["정부는 주거 문제에 해결하기 위한 정책을 마련했다.","정부는 주거 문제를 해결하기 위한 정책을 마련했다.","정부는 주거 문제가 해결하기 위한 정책을 마련했다.","정부는 주거 문제로 해결하기 위한 정책을 마련했다."],"a":"정부는 주거 문제를 해결하기 위한 정책을 마련했다.","d":2},
        {"type":"particle_choice","q":"지역 간 갈등___ 해결하기 위해 대화가 필요하다.","o":["이","을","에","으로"],"a":"을","d":1},
        {"type":"error_correction","q":"시민과 정부가 함께 환경 문제에 해결해야 한다.","a":"시민과 정부가 함께 환경 문제를 해결해야 한다.","d":3},
        {"type":"collocation_completion","q":"사회 문제를 ______","a":"해결하다","d":2},
        {"type":"natural_sentence","o":["대화를 통해 세대 간 갈등을 해결할 수 있다.","대화를 통해 세대 간 갈등이 해결할 수 있다.","대화를 통해 세대 간 갈등에 해결할 수 있다.","대화를 통해 세대 간 갈등으로 해결할 수 있다."],"a":"대화를 통해 세대 간 갈등을 해결할 수 있다.","d":2},
    ]),
    spec("성과를 거두다", "noun_verb_collocation", "general_topik", "성과나 결과는 목적어로 두고 '거두다'와 결합한다.", ["성과를 거두다", "좋은 결과를 거두다", "성공을 거두다"], ["성과에 거두다"], [
        {"type":"particle_choice","q":"연구팀은 국제 대회에서 뛰어난 성과___ 거두었다.","o":["가","를","에","로"],"a":"를","d":1},
        {"type":"natural_sentence","o":["꾸준한 노력은 좋은 결과를 거둘 수 있다.","꾸준한 노력은 좋은 결과가 거둘 수 있다.","꾸준한 노력은 좋은 결과에 거둘 수 있다.","꾸준한 노력은 좋은 결과로 거둘 수 있다."],"a":"꾸준한 노력은 좋은 결과를 거둘 수 있다.","d":2},
        {"type":"error_correction","q":"연구팀은 새로운 기술 개발에서 성과에 거두었다.","a":"연구팀은 새로운 기술 개발에서 성과를 거두었다.","d":3},
        {"type":"collocation_completion","q":"우수한 성과를 ______","a":"거두다","d":2},
        {"type":"particle_choice","q":"참가자들은 협력을 통해 성공___ 거둘 수 있었다.","o":["을","이","에","으로"],"a":"을","d":1},
    ]),
    spec("능력을 향상시키다", "noun_verb_collocation", "general_topik", "능력·실력·효율은 목적어로 두고 '향상시키다'와 결합한다.", ["능력을 향상시키다", "의사소통 능력을 향상시키다", "업무 능력을 향상시키다"], ["능력이 향상시키다"], [
        {"type":"natural_sentence","o":["교육은 문제 해결 능력이 향상시킨다.","교육은 문제 해결 능력을 향상시킨다.","교육은 문제 해결 능력에 향상시킨다.","교육은 문제 해결 능력으로 향상시킨다."],"a":"교육은 문제 해결 능력을 향상시킨다.","d":2},
        {"type":"particle_choice","q":"토론 수업은 의사소통 능력___ 향상시키는 데 도움이 된다.","o":["이","을","에","으로"],"a":"을","d":1},
        {"type":"error_correction","q":"반복 연습은 발표 능력이 향상시킨다.","a":"반복 연습은 발표 능력을 향상시킨다.","d":3},
        {"type":"collocation_completion","q":"업무 능력을 ______","a":"향상시키다","d":2},
        {"type":"natural_sentence","o":["디지털 교육은 정보 활용 능력을 향상시킨다.","디지털 교육은 정보 활용 능력이 향상시킨다.","디지털 교육은 정보 활용 능력에 향상시킨다.","디지털 교육은 정보 활용 능력으로 향상시킨다."],"a":"디지털 교육은 정보 활용 능력을 향상시킨다.","d":2},
    ]),
    spec("N에게 기회를 제공하다", "noun_verb_collocation", "general_topik", "사람에게 어떤 기회를 준다는 뜻은 'N에게 기회를 제공하다'로 쓴다.", ["청년에게 기회를 제공하다", "학생에게 교육 기회를 제공하다", "주민에게 참여 기회를 제공하다"], ["청년을 기회를 제공하다"], [
        {"type":"particle_choice","q":"정부는 청년___ 취업 기회를 제공해야 한다.","o":["을","에게","이","으로"],"a":"에게","d":1},
        {"type":"natural_sentence","o":["학교는 학생에게 다양한 경험의 기회를 제공한다.","학교는 학생을 다양한 경험의 기회를 제공한다.","학교는 학생이 다양한 경험의 기회를 제공한다.","학교는 학생으로 다양한 경험의 기회를 제공한다."],"a":"학교는 학생에게 다양한 경험의 기회를 제공한다.","d":2},
        {"type":"error_correction","q":"지역 사회는 주민을 문화 활동 기회를 제공할 필요가 있다.","a":"지역 사회는 주민에게 문화 활동 기회를 제공할 필요가 있다.","d":3},
        {"type":"collocation_completion","q":"학생에게 참여 기회를 ______","a":"제공하다","d":2},
        {"type":"particle_choice","q":"기업은 신입 사원___ 실무 교육 기회를 마련했다.","o":["을","에게","이","로"],"a":"에게","d":1},
    ]),
    spec("환경을 조성하다", "noun_verb_collocation", "general_topik", "학습·근무·토론 환경은 목적어로 두고 '조성하다'와 결합한다.", ["학습 환경을 조성하다", "안전한 근무 환경을 조성하다", "토론 환경을 조성하다"], ["환경이 조성하다"], [
        {"type":"natural_sentence","o":["학교는 자유로운 토론 환경이 조성해야 한다.","학교는 자유로운 토론 환경을 조성해야 한다.","학교는 자유로운 토론 환경에 조성해야 한다.","학교는 자유로운 토론 환경으로 조성해야 한다."],"a":"학교는 자유로운 토론 환경을 조성해야 한다.","d":2},
        {"type":"particle_choice","q":"기업은 안전한 근무 환경___ 조성할 책임이 있다.","o":["이","을","에","으로"],"a":"을","d":1},
        {"type":"error_correction","q":"지역 사회는 청소년을 위한 학습 환경이 조성해야 한다.","a":"지역 사회는 청소년을 위한 학습 환경을 조성해야 한다.","d":3},
        {"type":"collocation_completion","q":"창의적인 환경을 ______","a":"조성하다","d":2},
        {"type":"natural_sentence","o":["상호 존중하는 조직 문화를 조성하는 것이 중요하다.","상호 존중하는 조직 문화가 조성하는 것이 중요하다.","상호 존중하는 조직 문화에 조성하는 것이 중요하다.","상호 존중하는 조직 문화로 조성하는 것이 중요하다."],"a":"상호 존중하는 조직 문화를 조성하는 것이 중요하다.","d":2},
    ]),
    spec("N에 도움이 되다", "verb_collocation", "general_topik", "도움이 되는 대상에는 조사 '에'를 쓴다.", ["학습에 도움이 되다", "건강 관리에 도움이 되다", "문제 해결에 도움이 되다"], ["학습을 도움이 되다"], [
        {"type":"particle_choice","q":"독서는 어휘력 향상___ 도움이 된다.","o":["을","이","에","으로"],"a":"에","d":1},
        {"type":"natural_sentence","o":["규칙적인 운동은 건강 관리에 도움이 된다.","규칙적인 운동은 건강 관리를 도움이 된다.","규칙적인 운동은 건강 관리가 도움이 된다.","규칙적인 운동은 건강 관리로 도움이 된다."],"a":"규칙적인 운동은 건강 관리에 도움이 된다.","d":2},
        {"type":"error_correction","q":"다양한 독서 경험은 사고력 향상을 도움이 된다.","a":"다양한 독서 경험은 사고력 향상에 도움이 된다.","d":3},
        {"type":"collocation_completion","q":"문제 해결에 도움이 ______","a":"되다","d":2},
        {"type":"particle_choice","q":"상담은 진로 선택___ 실질적인 도움이 될 수 있다.","o":["에","을","이","로"],"a":"에","d":1},
    ]),
    spec("N의 원인이 되다", "noun_verb_collocation", "general_topik", "어떤 결과를 낳는 원인은 'N의 원인이 되다'로 쓴다.", ["갈등의 원인이 되다", "사고의 원인이 되다", "문제의 원인이 되다"], ["문제에 원인이 되다"], [
        {"type":"natural_sentence","o":["과도한 경쟁은 갈등의 원인이 될 수 있다.","과도한 경쟁은 갈등에 원인이 될 수 있다.","과도한 경쟁은 갈등을 원인이 될 수 있다.","과도한 경쟁은 갈등으로 원인이 될 수 있다."],"a":"과도한 경쟁은 갈등의 원인이 될 수 있다.","d":2},
        {"type":"particle_choice","q":"부주의한 운전은 교통사고___ 원인이 된다.","o":["이","의","을","에"],"a":"의","d":1},
        {"type":"error_correction","q":"무분별한 개발은 환경 문제에 원인이 될 수 있다.","a":"무분별한 개발은 환경 문제의 원인이 될 수 있다.","d":3},
        {"type":"collocation_completion","q":"사회 문제의 원인이 ______","a":"되다","d":2},
        {"type":"natural_sentence","o":["소통 부족은 오해의 원인이 되기 쉽다.","소통 부족은 오해에 원인이 되기 쉽다.","소통 부족은 오해를 원인이 되기 쉽다.","소통 부족은 오해로 원인이 되기 쉽다."],"a":"소통 부족은 오해의 원인이 되기 쉽다.","d":2},
    ]),
    spec("N으로 이어지다", "verb_collocation", "general_topik", "결과나 변화로 연결될 때는 'N으로 이어지다'를 쓴다.", ["갈등으로 이어지다", "건강 악화로 이어지다", "삶의 질 저하로 이어지다"], ["문제에 이어지다"], [
        {"type":"particle_choice","q":"과도한 업무는 건강 악화___ 이어질 수 있다.","o":["에","으로","을","이"],"a":"으로","d":1},
        {"type":"natural_sentence","o":["작은 오해가 심각한 갈등으로 이어질 수 있다.","작은 오해가 심각한 갈등에 이어질 수 있다.","작은 오해가 심각한 갈등을 이어질 수 있다.","작은 오해가 심각한 갈등이 이어질 수 있다."],"a":"작은 오해가 심각한 갈등으로 이어질 수 있다.","d":2},
        {"type":"error_correction","q":"지속적인 스트레스는 정신 건강 문제에 이어질 수 있다.","a":"지속적인 스트레스는 정신 건강 문제로 이어질 수 있다.","d":3},
        {"type":"collocation_completion","q":"삶의 질 저하로 ______","a":"이어지다","d":2},
        {"type":"particle_choice","q":"무분별한 소비는 가계 부담___ 이어질 수 있다.","o":["으로","에","을","이"],"a":"으로","d":1},
    ]),
    spec("N을/를 예방하다", "noun_verb_collocation", "general_topik", "사고·질병·범죄 같은 발생 가능한 문제를 목적어로 두고 '예방하다'와 결합한다.", ["사고를 예방하다", "질병을 예방하다", "범죄를 예방하다"], ["범죄에 예방하다"], [
        {"type":"natural_sentence","o":["안전 교육은 사고를 예방하는 데 필요하다.","안전 교육은 사고가 예방하는 데 필요하다.","안전 교육은 사고에 예방하는 데 필요하다.","안전 교육은 사고로 예방하는 데 필요하다."],"a":"안전 교육은 사고를 예방하는 데 필요하다.","d":2},
        {"type":"particle_choice","q":"정기 검진은 질병___ 예방하는 데 도움이 된다.","o":["이","을","에","으로"],"a":"을","d":1},
        {"type":"error_correction","q":"정부는 범죄에 예방하기 위해 조명을 늘렸다.","a":"정부는 범죄를 예방하기 위해 조명을 늘렸다.","d":3},
        {"type":"collocation_completion","q":"감염병을 ______","a":"예방하다","d":2},
        {"type":"natural_sentence","o":["개인정보 보호는 금융 범죄를 예방하는 첫걸음이다.","개인정보 보호는 금융 범죄가 예방하는 첫걸음이다.","개인정보 보호는 금융 범죄에 예방하는 첫걸음이다.","개인정보 보호는 금융 범죄로 예방하는 첫걸음이다."],"a":"개인정보 보호는 금융 범죄를 예방하는 첫걸음이다.","d":2},
    ]),
]


def _stable_id(value: str) -> str:
    return value.replace("/", "-").replace(" ", "-").replace("·", "-").lower()


def build_artifacts() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    errors_path = DATA_DIR / "language_errors.json"
    errors = json.loads(errors_path.read_text(encoding="utf-8")) if errors_path.exists() else []
    frequencies = Counter(
        str(error.get("pattern")) for error in errors if isinstance(error, dict)
    )
    patterns: list[dict[str, Any]] = []
    questions: list[dict[str, Any]] = []
    for pattern_index, item in enumerate(SPECS, start=1):
        set_index = (pattern_index - 1) // 4 + 1
        set_id = f"review-set-{set_index}"
        pattern_id = f"pattern-{pattern_index:02d}-{_stable_id(item['pattern'])}"
        patterns.append({
            "id": pattern_id,
            "pattern": item["pattern"],
            "category": item["category"],
            "explanation": item["explanation"],
            "correctExamples": item["correctExamples"],
            "commonMistakes": item["commonMistakes"],
            "frequency": frequencies.get(item["pattern"], 0),
            "difficulty": 2,
            "source": item["source"],
            "confidence": 0.99,
        })
        for within_pattern, question in enumerate(item["items"], start=1):
            question_type = question["type"]
            question_text = question.get("q")
            if question_type == "natural_sentence":
                question_text = "가장 자연스러운 문장을 고르시오."
            elif question_type == "error_correction":
                question_text = "다음 문장에서 잘못된 부분을 고쳐 쓰시오.\n\n" + str(question_text)
            elif question_type == "collocation_completion":
                question_text = "다음 표현을 자연스럽게 완성하시오.\n\n" + str(question_text)
            questions.append({
                "id": f"review-{set_index}-{pattern_index:02d}-{within_pattern}",
                "setId": set_id,
                "setPosition": (pattern_index - 1) % 4 * 5 + within_pattern,
                "type": question_type,
                "question": question_text,
                "options": question.get("o", []),
                "answer": question["a"],
                "acceptedAnswers": [question["a"]],
                "explanation": item["explanation"],
                "targetPattern": item["pattern"],
                "patternId": pattern_id,
                "category": item["category"],
                "difficulty": question["d"],
                "source": item["source"],
            })
    known_patterns = {str(item["pattern"]) for item in patterns}
    for error_pattern in sorted(frequencies):
        if not error_pattern or error_pattern in known_patterns:
            continue
        occurrences = [
            error for error in errors
            if isinstance(error, dict) and str(error.get("pattern")) == error_pattern
        ]
        first = occurrences[0]
        patterns.append({
            "id": f"pattern-extra-{_stable_id(error_pattern)}",
            "pattern": error_pattern,
            "category": str(first["category"]),
            "explanation": str(first["explanation"]),
            "correctExamples": list(dict.fromkeys(str(error["naturalExpression"]) for error in occurrences)),
            "commonMistakes": list(dict.fromkeys(str(error["incorrectExpression"]) for error in occurrences)),
            "frequency": len(occurrences),
            "difficulty": 1,
            "source": "user_error",
            "confidence": min(float(error.get("confidence", 0)) for error in occurrences),
        })
    return SETS, patterns, questions


def main() -> None:
    review_sets, patterns, questions = build_artifacts()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for filename, value in (("review_sets.json", review_sets), ("patterns.json", patterns), ("questions.json", questions)):
        (DATA_DIR / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(patterns)} patterns and {len(questions)} questions in {len(review_sets)} sets")


if __name__ == "__main__":
    main()
