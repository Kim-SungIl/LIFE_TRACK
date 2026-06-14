// ===== LIFE TRACK: 선택의 결과 — Core Types =====

import type { ParentEffect } from './parentIntimacy';

export type Gender = 'male' | 'female';
export type ParentStrength = 'wealth' | 'info' | 'resilience' | 'emotional' | 'freedom' | 'strict';

export interface Stats {
  academic: number;   // 학업 0~100
  social: number;     // 인기 0~100
  talent: number;     // 특기 0~100
  mental: number;     // 멘탈 0~100
  health: number;     // 체력 0~100
}

export type StatKey = keyof Stats;

export type Track = 'humanities' | 'science';

export interface GameState {
  week: number;             // 1~48 (1년)
  year: number;             // 1~7 (Y1=초6, Y7=고3)
  phase: 'setup' | 'weekday' | 'weekend' | 'vacation' | 'result' | 'event' | 'semester-end' | 'year-end' | 'ending';
  track: Track | null;      // 문과/이과 (Y6 고2 시작 때 선택)
  gender: Gender;
  stats: Stats;
  fatigue: number;          // 피로 0~100
  money: number;            // 용돈 (만원 단위)
  parents: [ParentStrength, ParentStrength];
  mentalState: 'normal' | 'tired' | 'burnout';
  routineSlot2: string | null;  // 방과후 루틴 1
  routineSlot3: string | null;  // 방과후 루틴 2
  // 슬롯별 루틴 연속 주수 — 슬롯 1개만 변경 시 다른 슬롯 보너스 보전
  routineSlot2Weeks: number;
  routineSlot3Weeks: number;
  weekendChoices: string[];     // 이번 주 주말 선택
  vacationChoices: string[];    // 방학 슬롯 선택
  semester: 1 | 2;
  isVacation: boolean;
  weekLog: WeekLog | null;
  npcs: NpcState[];
  events: GameEvent[];
  currentEvent: GameEvent | null;
  milestones: string[];         // 달성한 마일스톤 ID
  burnoutCount: number;
  totalWeeksPlayed: number;
  examResults: ExamResult[];       // 역대 시험 결과
  currentExamResult: ExamResult | null;  // 이번 시험 결과 (표시용)
  activeBuffs: ActiveBuff[];       // 활성 버프
  weekPurchases: Record<string, number>; // 이번 주 구매 횟수
  idleWeeks: number;                // v6: 연속 비생산적 주 카운트
  consecutiveTiredWeeks: number;    // v6.4: 연속 피로 주수 (만성 피로 패널티)
  burnoutCooldown: number;          // 번아웃 회복 직후 면역 주수 (재진입 방지)
  eventTimeCost: number;            // 이벤트 시간 소모: 0=없음, 1=1슬롯, 2=2슬롯
  // v1.2 기억 슬롯 시스템
  memorySlots: MemorySlot[];        // 최대 12 (카테고리당 2)
  milestoneScenes: MilestoneScene[]; // 학년별 1개, 최대 7
  rngSeed: number;                  // 결정론적 RNG 시드 (이벤트 선택용)
  hardCrisisYears: number[];        // 하드위기 발동 연도 (연간 1회 가드)
  // M6: 자연 회복 감소 모드 (도전 모드) — 상점 의존성·의사결정 부담 강화
  useReducedRecovery?: boolean;
  // Phase 1 방학 시스템 — 활동별 방학 내 사용 횟수 (방학 진입 시 리셋)
  vacationActivityCounts?: Record<string, number>;
  // Phase 2.1 말걸기 미니 이벤트 시스템 — 사전 결정 모델
  // 매주 시작 시 pressure 기반으로 이번 주 이벤트 발동 여부를 미리 결정.
  // 클릭은 단지 결과를 드러내는 행위 — 무한 가능, 비-pending 주는 매번 정적 대사.
  talkEventPressure: number;          // 0~1, NPC 미니 이벤트 누적 확률 (매주 +0.1)
  parentTalkPressure: number;         // 0~1, 부모 미니 이벤트 누적 확률 (매주 +0.05)
  parentIntimacy: number;             // 0~100, 숨겨진 부모 친밀도 (UI 미표시, 회고 톤에 영향)
  actedWithParentThisWeek?: boolean;  // 이번 주 부모 관련 행동(활동/대화) 여부 — 평균 회귀 면제용(매주 리셋)
  talkEventsFired: string[];          // 발동된 미니 이벤트 ID — 1회 발동 보장(A안). NPC 전용(부모는 parentEventsFired로 이관)
  npcEventPendingThisWeek: boolean;   // 이번 주 NPC 미니 이벤트 사전 결정 결과
  parentEventPendingThisWeek: boolean;// 이번 주 가정 미니 이벤트 사전 결정 결과
  // Phase 2A: 부모 미니 이벤트는 영구 1회가 아니라 쿨다운 후 재발동(±선택지로 하강압력 부여).
  // id별 마지막 발동 totalWeeksPlayed를 기록해 쿨다운/로테이션 판정. (없으면 미발동 취급)
  parentEventsFired?: { id: string; week: number }[];
  // Phase 2B: strict 부모 성적향상 어드밴티지의 연간 1회 가드(hardCrisisYears 패턴). 발동 연도 기록.
  parentPraiseYears?: number[];
  // Phase 4B: 강점별 "절정 순간". parentClimaxFired = 발동 완료 강점(평생 1회 가드).
  // parentPositiveTags = 긍정 부모 태그 누적 횟수(절정 트리거 자격). applyParentIntimacyDelta 단일 진입점에서 적립.
  parentClimaxFired?: ParentStrength[];
  parentPositiveTags?: Partial<Record<string, number>>;
}

// 활성 버프 (shopSystem에서도 사용)
export interface ActiveBuff {
  id: string;
  name: string;
  target: string;       // 활동 카테고리 or 'exam' or 'all' or stat key
  amount: number;        // 효율 증가 비율
  remainingWeeks: number;
}

export interface ParentBonusApplied {
  parent: ParentStrength;
  /** 한 줄 요약 ("학원 효율 +10%" 같은 표시용) */
  what: string;
}

export interface WeekLog {
  statChanges: Partial<Stats>;
  fatigueChange: number;
  moneyChange: number;
  messages: string[];
  milestone: string | null;      // 하위호환용 (deprecated)
  milestoneMessages: string[];   // 이번 주 달성한 성장 메시지들
  examResult?: ExamResult | null; // 이번 주 시험 결과 (없으면 undefined)
  /** 이번 주 발동한 부모 보너스 (UX 가시화용 — 인라인 스티커, WeekLog 1줄, HUD 펄스) */
  parentBonusesApplied?: ParentBonusApplied[];
  /** 이번 주 parentEffect를 이미 적용한 활동 id — 같은 활동의 슬롯 중복(루틴+주말) 친밀도 2배 방지 */
  parentEffectAppliedIds?: string[];
}

// 시험 시스템
export type SubjectKey = 'korean' | 'english' | 'math' | 'socialScience' | 'artsPhysical';
export const SUBJECT_LABELS: Record<SubjectKey, string> = {
  korean: '국어', english: '영어', math: '수학',
  socialScience: '사회/과학', artsPhysical: '예체능',
};
export type ExamGrade = 'S' | 'A' | 'B' | 'C' | 'D';
export type ElementaryGrade = '잘함' | '보통' | '노력필요';
export type SchoolLevel = 'elementary' | 'middle' | 'high';
export type ExamType = 'unit-test' | 'midterm' | 'final' | 'mock' | 'suneung';
export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  'unit-test': '단원평가',
  'midterm': '중간고사',
  'final': '기말고사',
  'mock': '모의고사',
  'suneung': '수능',
};

export interface SubjectResult {
  score: number;        // 0~100 원점수
  grade: ExamGrade;
  delta: number;        // 전 시험 대비 변화
  elementaryGrade?: ElementaryGrade; // 초등 전용 3단계 평가
}
export interface ExamResult {
  subjects: Record<SubjectKey, SubjectResult>;
  average: number;
  rank: number | null;         // 반 석차 (1~30), 초등은 null
  prevRank: number | null;
  comment: string;      // 한 줄 총평
  parentReaction: string;
  teacherReaction: string;
  examType: ExamType;
  schoolLevel: SchoolLevel;
  year: number;
  semester: number;
  mockGrade?: number;          // 모의고사 1~9등급 (고등 모의/수능 전용)
  mentalDelta?: number;        // 시험 결과로 인한 멘탈 변화량
}

export interface Activity {
  id: string;
  name: string;
  slots: number;
  fatigue: number;
  effects: Partial<Stats>;
  moneyCost: number;
  // 학년별 비용 차등 (현실 고증 — 학년 올라가면 비싸짐). 미설정 시 moneyCost 사용.
  yearlyCost?: { elementary?: number; middle?: number; high?: number };
  description: string;
  flavor: string;           // 서사적 설명 한 줄
  tags: string[];           // 분위기 태그
  requires?: (state: GameState) => boolean;
  category: 'study' | 'exercise' | 'social' | 'talent' | 'rest' | 'work' | 'parent';
  // 부모 친밀도 효과 (stat이 아니므로 effects와 별개 — applyParentIntimacyDelta로 처리)
  parentEffect?: ParentEffect;
  // Phase 1 방학 시스템
  seasonGate?: 'vacation-only' | 'semester-only';   // 학기/방학 게이팅
  vacationLimit?: number;                           // 방학당 최대 선택 횟수 (없으면 무제한)
  catchupBonus?: {                                  // 낮은 스탯 보정 (방학에만 트리거)
    targetStat: StatKey;
    threshold: number;                              // 이 값 미만이면 적용
    bonus: number;                                  // 추가 효과량
  };
  vacationDescription?: string;                     // 방학 시 description 오버라이드 (academy → 단기특강 등)
}

export interface NpcState {
  id: string;
  name: string;
  intimacy: number;       // 0~100
  description: string;
  emoji: string;
  met: boolean;           // 만남 여부
  greeting?: string;      // 클릭 시 인사말
  personality?: string;   // 성격/관계 설명
  weekStartIntimacy?: number; // 도달형 페이싱용 — 이번 주 시작 시점 친밀도(processWeek에서 스냅샷). fresh/pre-met 판별.
}

export type EventLocation = 'classroom' | 'home' | 'park' | 'hallway' | 'rooftop' | 'street' | 'gym' | 'school_gate' | 'cafe' | 'music_room' | 'beach' | 'convenience_store' | 'library' | 'auditorium';

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
  week?: number;          // 특정 주에만 발생
  condition?: (state: GameState) => boolean;
  location?: EventLocation; // 이벤트 장소 (배경 이미지/폴백 색상)
  speakers?: string[];    // 등장 NPC ID (캐릭터 표시 순서)
  background?: string;  // 배경 이미지 키 (없으면 기본 배경 사용)
  // 성별 분기: 있으면 해당 성별에서 기본값 대신 사용
  femaleDescription?: string;
  femaleChoices?: EventChoice[];
  resolvedChoice?: number; // 저장된 선택 인덱스 (이벤트 해결 후 기록)
  resolvedFemale?: boolean; // v1.2: femaleChoices 경로로 해결되었는지 (엔딩 해시 구분용)
  year?: number;           // 저장된 발생 연차 (ANNUAL 재발동 판정용)
  // 도달형(reach) 메타데이터 — 페이싱 엔진용. 있으면 이 이벤트는 도달형으로 취급.
  // npc: 대상 NPC, tier: 친밀도 임계, year: 게이트된 학년(쿨다운 = 48 ÷ 그 NPC·그 해 reach 수).
  reach?: { npc: string; tier: number; year: number };
}

export interface EventChoice {
  text: string;
  effects: Partial<Stats>;
  fatigueEffect?: number;
  moneyEffect?: number;
  npcEffects?: { npcId: string; intimacyChange: number }[];
  message: string;
  timeCost?: 1 | 2; // 시간 소모: 1=루틴/주말 1슬롯, 2=루틴/주말 2슬롯
  trackSelect?: Track; // 문과/이과 선택 (Y6 W1 이벤트 전용)
  // 선택지 노출 조건 — 만족 안 하면 UI에서 숨김 (예: 돈/스탯 게이팅)
  condition?: (state: GameState) => boolean;
  // v1.2: 이 선택을 고르면 엔딩 회상 슬롯 생성 후보 (importance ≥3만 실제 생성)
  memorySlotDraft?: MemorySlotDraft;
  // M4: 이 선택을 고르면 활성 버프에 추가 (상점 버프와 동일 구조)
  addBuff?: ActiveBuff;
  // Phase 4C: 이 선택이 부모 친밀도에 주는 반응(태그+baseDelta) — applyParentIntimacyDelta로 처리(스탯 아님).
  //           강점 배율·구간 감쇠는 단일 진입점에서 적용. 적용 시 그 주 평균회귀 면제.
  parentEffect?: ParentEffect;
}

// ===== v1.2 기억 슬롯 시스템 =====

export type MemoryCategory =
  | 'courage'         // 용기: 반장 자원, 장기자랑
  | 'betrayal'        // 상처: 약속 어김, 험담
  | 'reconciliation'  // 화해: 사과, 오해 풀기
  | 'failure'         // 실패: 시험 대실수, 낙방
  | 'discovery'       // 깨달음: 진로 결정, 재능 발견
  | 'growth'          // 성장: 번아웃 극복, 가치관 변화
  | 'bypass'          // 우회: 돈으로 건너뛴 순간 (wealth 부모 전용)
  | 'unspoken_debt';  // 갚을 수 없는 감사: 말없이 놓인 봉투 (wealth 부모 전용)

export type PhaseTag = 'early' | 'mid' | 'late';
// early: Y1~Y2 (초6~중1)
// mid:   Y3~Y4 (중2~중3)
// late:  Y5~Y7 (고1~고3)

export type ToneTag = 'warm' | 'regret' | 'resolve' | 'breakthrough' | 'melancholy' | 'burden';

export interface MemorySlotDraft {
  category: MemoryCategory;
  importance: number;  // 1~10, 부록 C 기준. <3은 슬롯 생성 스킵
  toneTag?: ToneTag;
  recallText: string;  // 20~35자, 과거 회상형, 스탯 금지
  npcIds?: string[];
}

export interface MemorySlot {
  id: string;           // {category}_{year}_{week}_{choiceIndex}
  category: MemoryCategory;
  week: number;
  year: number;
  sourceEventId: string;
  choiceIndex: number;
  recallText: string;
  npcIds?: string[];
  importance: number;
  phaseTag: PhaseTag;   // year 기반 자동 산출
  toneTag?: ToneTag;
}

export type MilestoneTheme = 'connection' | 'pressure' | 'identity' | 'loss' | 'growth';

export interface MilestoneScene {
  year: number;              // 1~7
  sceneId: string;           // 렌더링 템플릿 키
  dominantTheme?: MilestoneTheme;
  sourceMemoryIds?: string[];  // 이 학년의 주요 memorySlot 참조
  summaryText?: string;
  recordedAt: number;        // 기록 주차
}

export const STAT_LABELS: Record<StatKey, string> = {
  academic: '학업',
  social: '인기',
  talent: '특기',
  mental: '멘탈',
  health: '체력',
};

export const STAT_GRADES = [
  { min: 80, grade: 'A', label: '최상', color: '#e5c07b' },
  { min: 60, grade: 'B', label: '우수', color: '#8fb573' },
  { min: 40, grade: 'C', label: '보통', color: '#e0b354' },
  { min: 20, grade: 'D', label: '부족', color: '#d96458' },
  { min: 0,  grade: 'E', label: '매우 부족', color: '#8a8078' },
];

export function getGrade(value: number) {
  return STAT_GRADES.find(g => value >= g.min) || STAT_GRADES[STAT_GRADES.length - 1];
}

// 스탯별 등급 라벨 — STAT_GRADES의 일반 라벨(최상/우수/보통/부족/매우 부족) 대신
// 각 스탯의 의미를 즉시 알 수 있는 짧은 표현. HUD 펼쳐진 상태에서 표시.
export const STAT_FLAVOR_LABELS: Record<StatKey, Record<string, string>> = {
  academic: { A: '상위권',     B: '준상위권', C: '평범',     D: '하위권',     E: '바닥권' },
  social:   { A: '인기 많음',  B: '친구 많음', C: '평범',     D: '소수와 친함', E: '외톨이' },
  talent:   { A: '재능 있음',  B: '특기 있음', C: '평범',     D: '특기 없음',  E: '무관심' },
  mental:   { A: '단단함',     B: '안정적',   C: '평범',     D: '불안',       E: '무너지기 직전' },
  health:   { A: '튼튼함',     B: '건강',     C: '보통',     D: '허약',       E: '병약' },
};
