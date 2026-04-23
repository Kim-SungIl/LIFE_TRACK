// ===== LIFE TRACK: 선택의 결과 — Core Types =====

export type Gender = 'male' | 'female';
export type ParentStrength = 'wealth' | 'info' | 'gene' | 'emotional' | 'freedom' | 'strict';

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
  routineWeeks: number;         // 루틴 연속 주수
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
  unlockedEvents: string[];         // 상점 event_unlock 아이템으로 해금된 이벤트 ID
  // v1.2 기억 슬롯 시스템
  memorySlots: MemorySlot[];        // 최대 12 (카테고리당 2)
  socialRipples: SocialRipple[];    // NPC 간 관계 전염
  milestoneScenes: MilestoneScene[]; // 학년별 1개, 최대 7
  rngSeed: number;                  // 결정론적 RNG 시드 (이벤트 선택용)
  hardCrisisYears: number[];        // 하드위기 발동 연도 (연간 1회 가드)
  // M6: 자연 회복 감소 모드 (도전 모드) — 상점 의존성·의사결정 부담 강화
  useReducedRecovery?: boolean;
}

// 활성 버프 (shopSystem에서도 사용)
export interface ActiveBuff {
  id: string;
  name: string;
  target: string;       // 활동 카테고리 or 'exam' or 'all' or stat key
  amount: number;        // 효율 증가 비율
  remainingWeeks: number;
}

export interface WeekLog {
  statChanges: Partial<Stats>;
  fatigueChange: number;
  moneyChange: number;
  messages: string[];
  milestone: string | null;      // 하위호환용 (deprecated)
  milestoneMessages: string[];   // 이번 주 달성한 성장 메시지들
  examResult?: ExamResult | null; // 이번 주 시험 결과 (없으면 undefined)
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
  description: string;
  flavor: string;           // 서사적 설명 한 줄
  tags: string[];           // 분위기 태그
  requires?: (state: GameState) => boolean;
  category: 'study' | 'exercise' | 'social' | 'talent' | 'rest' | 'work' | 'parent';
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
}

export interface EventChoice {
  text: string;
  effects: Partial<Stats>;
  fatigueEffect?: number;
  mentalEffect?: number;
  moneyEffect?: number;
  npcEffects?: { npcId: string; intimacyChange: number }[];
  message: string;
  timeCost?: 1 | 2; // 시간 소모: 1=루틴/주말 1슬롯, 2=루틴/주말 2슬롯
  trackSelect?: Track; // 문과/이과 선택 (Y6 W1 이벤트 전용)
  // v1.2: 이 선택을 고르면 엔딩 회상 슬롯 생성 후보 (importance ≥3만 실제 생성)
  memorySlotDraft?: MemorySlotDraft;
  // v1.2: 이 선택을 고르면 활성화되는 ripple ID 목록
  activateRipples?: string[];
  // M4: 이 선택을 고르면 활성 버프에 추가 (상점 버프와 동일 구조)
  addBuff?: ActiveBuff;
}

// ===== v1.2 기억 슬롯 시스템 =====

export type MemoryCategory =
  | 'courage'         // 용기: 반장 자원, 장기자랑
  | 'betrayal'        // 상처: 약속 어김, 험담
  | 'reconciliation'  // 화해: 사과, 오해 풀기
  | 'failure'         // 실패: 시험 대실수, 낙방
  | 'discovery'       // 깨달음: 진로 결정, 재능 발견
  | 'growth';         // 성장: 번아웃 극복, 가치관 변화

export type PhaseTag = 'early' | 'mid' | 'late';
// early: Y1~Y2 (초6~중1)
// mid:   Y3~Y4 (중2~중3)
// late:  Y5~Y7 (고1~고3)

export type ToneTag = 'warm' | 'regret' | 'resolve' | 'breakthrough';

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

export type RippleType =
  | 'admiration'    // 감탄
  | 'jealousy'      // 질투
  | 'concern'       // 걱정
  | 'rumor'         // 소문
  | 'group_unlock'; // 그룹 이벤트 해금

export type RippleSourceCondition =
  | 'intimacy_high'  // 친밀도 ≥70
  | 'intimacy_mid'   // 친밀도 ≥50
  | 'event_resolved' // 특정 이벤트 resolvedChoice 종료
  | 'drifted';       // 친밀도 ≤20

export interface SocialRipple {
  id: string;
  sourceNpcId: string;
  targetNpcId: string;
  sourceCondition: RippleSourceCondition;
  rippleType: RippleType;
  activatedAt?: number;      // 활성 주차 (없으면 비활성)
  consumed?: boolean;        // 일회성 소비 후 재활성 금지
  sourceEventId?: string;
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
