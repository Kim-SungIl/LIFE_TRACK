// 최소 계측 — **이 기기에만** 쌓는 익명 플레이 기록. (설계안 docs/monthly-plan-design-2026-10.md §12 6단계)
//
// 월 단위 계획의 프로토타입 판정 기준(§12)은 실제 플레이에서만 잴 수 있다 — 지금까지 게임에 계측이 0건이라
// 오픈베타에서도 못 쟀다. 여기서 세는 것은 그 기준에 닿는 것뿐이다:
//   · month  — 달 계획을 칸을 하나도 안 고치고 시작했나(채우기 버튼만/아무것도 안 함) → "지난달처럼만 누르고 끝낸 달" 비율
//   · stop   — 재생이 왜 멈췄나 → 판당 월중 멈춤 횟수
//   · talk   — 말걸기·가정 대화가 이야기(미니 이벤트·절정)로 이어진 순간 → 연간 횟수(§8 "±5%"). 잡담은 안 센다 —
//              무한히 누를 수 있어 기록만 부풀린다. 효과가 실제로 들어가는 한 자리에서만 센다(보류 중인 선택지 재열람 중복 없음).
//   · ending — 등급 → 등급 분포
//   · run    — 새 판 시작(월 단위 판인가)
//
// **밖으로 보내지 않는다.** 서버도 동의 화면도 없다 — 보내는 길은 수집 범위·동의와 같이 정할 일이라 여기 두지 않는다.
// 플레이어가 시스템 메뉴의 「플레이 기록 내보내기」로 파일을 받아 직접 건넬 수 있을 뿐이다(exportTelemetry).
// 이름·시각·세이브 내용은 싣지 않는다 — 친구는 게임 속 id(jihun 등)로만, 순서는 배열 순서로만 남는다.
//
// **게임을 건드리지 않는다.** 난수·상태를 읽지도 쓰지도 않는다(호출부가 값을 넘긴다). 저장소가 막히거나 꽉 차도
// 조용히 넘어간다 — 계측 실패가 플레이를 막으면 안 된다. 손상된 기록은 고치지 않고 새로 시작한다(#441 규약: 거부).
import type { PlaybackStop } from './types';

export const TELEMETRY_KEY = 'lifetrack_telemetry';
export const TELEMETRY_VERSION = 1;
/** 쌓는 상한 — 넘으면 오래된 것부터 버린다. 한 판 ≈ 달 84 + 멈춤 수십 + 대화 수백. 몇 판 치는 남는다. */
export const MAX_TELEMETRY_EVENTS = 3000;

export type TelemetryEvent =
  | { t: 'run'; monthly: boolean }
  | { t: 'month'; y: number; m: number; week: number; replan: boolean; edits: number; fills: number; invitesAccepted: number; invitesDeclined: number }
  | { t: 'stop'; y: number; w: number; reason: PlaybackStop }
  | { t: 'talk'; y: number; w: number; to: 'npc' | 'home' }
  | { t: 'ending'; achievement: string; happiness: string; burnouts: number };

export interface TelemetryLog {
  v: typeof TELEMETRY_VERSION;
  events: TelemetryEvent[];
}

const EVENT_KINDS = new Set<TelemetryEvent['t']>(['run', 'month', 'stop', 'talk', 'ending']);

function isLog(v: unknown): v is TelemetryLog {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return o.v === TELEMETRY_VERSION && Array.isArray(o.events)
    && o.events.every(e => !!e && typeof e === 'object' && EVENT_KINDS.has((e as { t: TelemetryEvent['t'] }).t));
}

/** 지금까지의 기록. 없거나 읽을 수 없거나 손상됐으면 빈 기록. */
export function readTelemetry(): TelemetryLog {
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY);
    if (!raw) return { v: TELEMETRY_VERSION, events: [] };
    const parsed: unknown = JSON.parse(raw);
    return isLog(parsed) ? parsed : { v: TELEMETRY_VERSION, events: [] };
  } catch {
    return { v: TELEMETRY_VERSION, events: [] };
  }
}

/** 한 건 적는다. 저장소가 막혔거나 꽉 찼으면 아무것도 안 한다. */
export function recordTelemetry(event: TelemetryEvent): void {
  try {
    const log = readTelemetry();
    log.events.push(event);
    if (log.events.length > MAX_TELEMETRY_EVENTS) log.events.splice(0, log.events.length - MAX_TELEMETRY_EVENTS);
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(log));
  } catch { /* 저장소 차단·용량 초과 — 계측은 플레이를 막지 않는다 */ }
}

export interface TelemetrySummary {
  runs: number;
  /** 처음 짠 달(다시 짜기 제외) 수와 그중 칸을 하나도 안 고친 달. §12 기준: 비율 70% 이상이면 "무게 실패". */
  months: number;
  untouchedMonths: number;
  untouchedRatio: number | null;
  /** 멈춤 이유별 횟수와 판당 월중 멈춤(계절 경계 제외 — 설계상 반드시 서는 자리). §12 기준: 10회 이하. */
  stops: Partial<Record<PlaybackStop, number>>;
  midMonthStopsPerRun: number | null;
  /** 이야기로 이어진 말걸기(친구)·가정 대화 수. */
  talks: { npc: number; home: number };
  /** 등급 분포 — `성취/행복` → 판 수. */
  endings: Record<string, number>;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export function summarizeTelemetry(log: TelemetryLog): TelemetrySummary {
  let runs = 0, months = 0, untouched = 0, midStops = 0;
  const stops: Partial<Record<PlaybackStop, number>> = {};
  const talks = { npc: 0, home: 0 };
  const endings: Record<string, number> = {};
  for (const e of log.events) {
    if (e.t === 'run') runs++;
    else if (e.t === 'month' && !e.replan) { months++; if (e.edits === 0) untouched++; }
    else if (e.t === 'stop') { stops[e.reason] = (stops[e.reason] ?? 0) + 1; if (e.reason !== 'season') midStops++; }
    else if (e.t === 'talk') talks[e.to]++;
    else if (e.t === 'ending') { const k = `${e.achievement}/${e.happiness}`; endings[k] = (endings[k] ?? 0) + 1; }
  }
  return {
    runs, months, untouchedMonths: untouched,
    untouchedRatio: months ? round3(untouched / months) : null,
    stops, midMonthStopsPerRun: runs ? round3(midStops / runs) : null,
    talks, endings,
  };
}

/** 내보내기 파일 본문 — 요약과 원본 기록. 플레이어가 피드백으로 건넬 때 쓴다. */
export function exportTelemetry(): string {
  const log = readTelemetry();
  return JSON.stringify({ app: 'lifetrack', v: TELEMETRY_VERSION, summary: summarizeTelemetry(log), events: log.events }, null, 2);
}
