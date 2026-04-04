import { StatKey } from './types';

interface StatDescription {
  name: string;
  what: string;          // 이 스탯이 뭔지
  why: string;           // 왜 중요한지
  high: string;          // 높으면 어떻게 되는지
  low: string;           // 낮으면 어떻게 되는지
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
    name: '재능',
    what: '예체능, 특기 분야의 숙련도',
    why: '대회 출전, 특기자 전형, 생활기록부에 영향',
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
