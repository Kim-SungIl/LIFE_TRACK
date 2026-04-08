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

export interface GameState {
  week: number;             // 1~48 (1년)
  year: number;             // 1~7 (Y1=초6, Y7=고3)
  phase: 'setup' | 'weekday' | 'weekend' | 'vacation' | 'result' | 'event' | 'semester-end' | 'year-end' | 'ending';
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
  eventTimeCost: number;            // 이벤트 시간 소모: 0=없음, 1=1슬롯, 2=2슬롯
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
}

// 시험 시스템
export type SubjectKey = 'korean' | 'english' | 'math' | 'socialScience' | 'artsPhysical';
export const SUBJECT_LABELS: Record<SubjectKey, string> = {
  korean: '국어', english: '영어', math: '수학',
  socialScience: '사회/과학', artsPhysical: '예체능',
};
export type ExamGrade = 'S' | 'A' | 'B' | 'C' | 'D';
export interface SubjectResult {
  score: number;        // 0~100 원점수
  grade: ExamGrade;
  delta: number;        // 전 시험 대비 변화
}
export interface ExamResult {
  subjects: Record<SubjectKey, SubjectResult>;
  average: number;
  rank: number;         // 반 석차 (1~30)
  prevRank: number | null;
  comment: string;      // 한 줄 총평
  parentReaction: string;
  teacherReaction: string;
  examType: 'midterm' | 'final';
  year: number;
  semester: number;
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
  // 성별 분기: 있으면 해당 성별에서 기본값 대신 사용
  femaleDescription?: string;
  femaleChoices?: EventChoice[];
  resolvedChoice?: number; // 저장된 선택 인덱스 (이벤트 해결 후 기록)
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
}

export const STAT_LABELS: Record<StatKey, string> = {
  academic: '학업',
  social: '인기',
  talent: '특기',
  mental: '멘탈',
  health: '체력',
};

export const STAT_GRADES = [
  { min: 80, grade: 'A', label: '최상', color: '#FFD700' },
  { min: 60, grade: 'B', label: '우수', color: '#4CAF50' },
  { min: 40, grade: 'C', label: '보통', color: '#FFC107' },
  { min: 20, grade: 'D', label: '부족', color: '#FF5722' },
  { min: 0,  grade: 'E', label: '매우 부족', color: '#9E9E9E' },
];

export function getGrade(value: number) {
  return STAT_GRADES.find(g => value >= g.min) || STAT_GRADES[STAT_GRADES.length - 1];
}
