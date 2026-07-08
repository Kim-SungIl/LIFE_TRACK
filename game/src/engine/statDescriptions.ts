import { StatKey, SchoolLevel } from './types';

interface StatDescription {
  name: string;
  what: string;          // 이 스탯이 뭔지
  why: string;           // 왜 중요한지
  high: string;          // 높으면 어떻게 되는지
  low: string;           // 낮으면 어떻게 되는지
}

// 학업 유지 난도 — 학교급이 오를수록 자연감쇠가 가속되는 것(gameEngine 주간 틱)의 질감 노출.
// 수치(-N/주)는 비공개, "잊는 속도"의 서열만 전달한다. 고등은 80+ 소프트캡(examSystem)의 존재도 함께 암시.
const ACADEMIC_KEEP_HINT: Record<SchoolLevel, string> = {
  elementary: '한번 익힌 건 잘 잊지 않는다',
  middle: '손을 놓으면 조금씩 잊는다',
  high: '일주일만 놓아도 훅 떨어지고, 80을 넘긴 실력은 그만큼 지키기도 어렵다',
};

// academic 설명을 학년에 맞게 조회 — StatsPanel 등 UI 는 이 함수를 쓴다.
export function getStatDescription(key: StatKey, year: number): StatDescription {
  const base = STAT_DESCRIPTIONS[key];
  if (key !== 'academic') return base;
  const level: SchoolLevel = year <= 1 ? 'elementary' : year <= 4 ? 'middle' : 'high';
  return { ...base, what: `${base.what}. ${ACADEMIC_KEEP_HINT[level]}` };
}

export const STAT_DESCRIPTIONS: Record<StatKey, StatDescription> = {
  academic: {
    name: '학업',
    what: '전반적인 학습 능력과 시험 성적',
    why: '등수, 대학 진학, 부모님 반응에 직접 영향',
    high: '상위권 → 선생님 인정, 특목고 지원, 장학금 기회',
    low: '하위권 → 부모 압박, 보충 수업, 자존감 하락',
  },
  social: {
    name: '인기',
    what: '학교에서의 존재감과 교우관계',
    why: 'NPC 만남 기회, 학교 행사, 연애 이벤트에 영향',
    high: '학교 유명인 → 이벤트 기회 증가, 첫 만남 호감도 상승',
    low: '투명인간 → 점심 혼밥, 관계 이벤트 감소',
  },
  talent: {
    name: '특기',
    what: '예체능, 창작, 실기 분야의 숙련도',
    why: '대회 출전, 특기자 전형, 수행평가, 생활기록부에 영향',
    high: '학교 대표 → 대회 입상, 특기자 진학, 인기 상승',
    low: '특기 없음 → 진로가 학업 일변도, 자기표현 수단 부족',
  },
  mental: {
    name: '멘탈',
    what: '정신적 안정, 스트레스 내성',
    why: '모든 활동의 효율에 영향. 낮으면 아무것도 안 됨',
    high: '단단한 멘탈 → 시험 실력 발휘, 부정 이벤트 저항',
    low: '피로→번아웃 → 활동 제한, 관계 붕괴, 회복에 수 주 소요',
  },
  health: {
    name: '체력',
    what: '신체 건강, 컨디션, 지구력',
    why: '피로 축적 속도, 병결 확률에 영향',
    high: '철인 체력 → 피로 회복 빠름, 밤샘해도 버팀',
    low: '허약 → 자주 아픔, 슬롯 손실, 모든 활동 효율 하락',
  },
};
