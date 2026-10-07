/**
 * T67: 성장 둔화 원인 — "공부를 더 했는데 왜 안 늘지?"에 엔진이 직접 답한다.
 *
 * applyActivity의 성장식은 여섯 겹이다(구간 감쇠·피로 배율·멘탈 상태·같은 축 중복·무료 소프트캡·
 * 주당 축 상한). 화면은 그중 무엇이 이번 주를 깎았는지 알 길이 없었고, 그래서 플레이어도 배울
 * 단서가 없었다. 처방은 **숫자를 공개하는 게 아니라** 그 주 결과를 가장 크게 깎은 원인 하나를
 * 생활 문장 한 줄로 말하는 것이다(hide-numbers).
 *
 * 이 파일이 두 가지의 SSOT다:
 *   ① 분해 — 활동 1회의 "막히지 않았다면 오를 몫"과 실제로 오른 몫의 차이를 요인별로 나눈다.
 *      applyActivity가 **이미 계산한 배율을 그대로 넘겨받아** 기록만 한다. 성장값 계산식은
 *      한 글자도 바꾸지 않는다(바이트 동일 — growthDrag.test.ts·다중시드 대조).
 *   ② 판정 — 그 주의 기록에서 주 원인 하나를 고른다(`pickGrowthReason`). 화면은 판정을 다시 하지
 *      않고 엔진이 로그에 박은 결과를 읽기만 한다 — 두 층이 따로 추정하면 갈린다(#441).
 *
 * ### 분해 방식 — 왜 로그 비율인가
 * 배율은 곱으로 겹치므로 "어느 배율이 얼마를 깎았나"는 적용 순서에 따라 답이 달라진다(먼저
 * 곱한 쪽이 더 많이 깎은 것처럼 보인다). 그래서 손실 총량을 각 배율의 −ln(f) 비율로 나눈다 —
 * 순서와 무관하고, 배율 하나만 걸린 경우엔 단순 차감과 같다.
 * 최저 보장이 값을 끌어올리면 그만큼 곱셈 손실이 줄어든다(같은 비율로 축소). 주당 상한은 곱이
 * 아니라 뺄셈이라 깎인 양을 그대로 적는다. 스탯 100 클램프로 잘린 몫은 '익숙함'에 접는다(맨 위에선
 * 더 배울 게 없다는 같은 사정이다).
 *
 * 불변식: 활동마다 `ideal − applied = Σ drag` (applied = 스탯에 실제로 더해진 양, 클램프 후).
 */
import type { StatKey, WeekLog } from './types';

/** 성장을 깎는 요인. 배열 순서 = 동률일 때의 우선순위(플레이어가 바꿀 수 있는 것부터). */
export const GROWTH_DRAG_FACTORS = [
  'fatigue',      // 피로 배율 — 몸이 피곤하다
  'mood',         // 멘탈 상태(tired/burnout) — 마음이 지쳤다
  'crowded',      // 같은 축 중복 — 한 주에 같은 쪽을 몰아 했다
  'weeklyCap',    // 주당 축 상한 — 한 주에 몸에 붙일 수 있는 양이 찼다
  'freeCeiling',  // 무료 활동 소프트캡 — 혼자 하는 방법으로는 더 못 올라간다
  'familiar',     // 구간 감쇠(+100 클램프) — 이미 잘하는 것이라 새로 남는 게 적다
] as const;
export type GrowthDragFactor = typeof GROWTH_DRAG_FACTORS[number];

/** 성장 축(멘탈은 회복 전용 감쇠라 이 분해 밖이다). */
export type GrowthAxis = Exclude<StatKey, 'mental'>;

/** 그 주 활동 성장의 장부. 구세이브 로그에는 없다(undefined = 기록 없음). */
export interface GrowthLedger {
  /** 막히지 않았다면 오를 몫의 합 */
  ideal: number;
  /** 실제로 스탯에 더해진 몫의 합(클램프 후) */
  applied: number;
  /** 요인 → 축 → 깎인 양 */
  drag: Partial<Record<GrowthDragFactor, Partial<Record<GrowthAxis, number>>>>;
}

const DRAG_EPSILON = 1e-9;

/** applyActivity가 이미 계산한 배율들 — 여기서는 읽기만 한다. */
export interface GrowthMultipliers {
  diminishing: number;
  fatigue: number;
  mood: number;
  crowded: number;
  freeCeiling: number;
}

/**
 * 활동 1회·축 1개의 손실을 장부에 적는다.
 * @param pre       곱셈 단계 직후 값(최저 보장·상한 전)
 * @param afterFloor 최저 보장 적용 후 값
 * @param afterCap  주당 상한 적용 후 값(= applyActivity가 더하려는 값)
 * @param applied   스탯에 실제로 더해진 양(0~100 클램프 후)
 */
export function recordGrowthDrag(
  log: WeekLog,
  axis: GrowthAxis,
  m: GrowthMultipliers,
  pre: number,
  afterFloor: number,
  afterCap: number,
  applied: number,
): void {
  const ledger = (log.growthLedger ??= { ideal: 0, applied: 0, drag: {} });
  const lossy: [GrowthDragFactor, number][] = [];
  if (m.diminishing < 1) lossy.push(['familiar', m.diminishing]);
  if (m.fatigue < 1) lossy.push(['fatigue', m.fatigue]);
  if (m.mood < 1) lossy.push(['mood', m.mood]);
  if (m.crowded < 1) lossy.push(['crowded', m.crowded]);
  if (m.freeCeiling < 1) lossy.push(['freeCeiling', m.freeCeiling]);

  let product = 1;
  for (const [, f] of lossy) product *= f;
  // 막히지 않았다면 — 손실 배율만 1로 되돌린 값. 가속(구간 감쇠 1.2)·버프·루틴은 그대로 둔다.
  const ideal = product > 0 ? pre / product : pre;

  const add = (factor: GrowthDragFactor, amount: number) => {
    // 부동소수 잔차(스탯 덧셈의 1e-15 따위)는 손실이 아니다 — 0으로 둔다.
    if (!(amount > DRAG_EPSILON)) return;
    const row = (ledger.drag[factor] ??= {});
    row[axis] = (row[axis] ?? 0) + amount;
  };

  const multLoss = Math.max(0, ideal - afterFloor);
  const weight = lossy.reduce((s, [, f]) => s - Math.log(f), 0);
  if (multLoss > 0 && weight > 0) {
    for (const [factor, f] of lossy) add(factor, multLoss * (-Math.log(f) / weight));
  }
  add('weeklyCap', afterFloor - afterCap);
  add('familiar', afterCap - applied);   // 100 클램프로 잘린 몫

  // ideal ≥ afterFloor는 항상 성립한다(바닥 = base×0.1 이하, ideal = base×가속·보너스 이상).
  ledger.ideal += ideal;
  ledger.applied += applied;
}


// ===== 판정 =====
//
// **실측이 판정 모양을 정했다**(scripts/sim/sim-growth-reason.ts, 유효 페르소나 23종 × 5시드 = 38,913주).
// 원시 "가장 많이 깎은 요인"은 구간 감쇠(familiar)가 56.5%, 무료 소프트캡(freeCeiling)이 38.4%였다 —
// 둘은 **지형**이다. 스탯이 높으면 매주, 무료 활동을 쓰면 매주 걸린다(무료 소프트캡이 걸린 주 91%).
// 그대로 내면 7년 내내 같은 두 문장이 4주마다 돈다(같은 요인 연속 최장 83회). 그래서 요인을 둘로 나눈다:
//   · **날씨**(fatigue·mood·crowded·weeklyCap) — 그 주의 선택이 만든다. 짧은 간격으로 다시 말해도 된다.
//   · **지형**(familiar·freeCeiling) — 한 번 알면 되는 사실이다. 같은 요인은 한 해에 한 번만 말한다.
// 주 원인은 "지금 말할 수 있는 요인 중 가장 많이 깎은 것"이다 — 지형이 쉬는 주에 피로가 1 이상
// 깎았다면 그 주의 사실은 "피곤해서 덜 남았다"이고, 그건 참이다.

/** 한 번 알면 되는 요인 — 스탯 구간·활동 종류가 정하는 지형. */
export const STRUCTURAL_GROWTH_DRAGS: ReadonlySet<GrowthDragFactor> = new Set<GrowthDragFactor>(['familiar', 'freeCeiling']);

/**
 * 문장이 축마다 다른 요인 — "이미 익숙하다"는 공부와 운동에서 다른 말이다. 피로·마음도 마찬가지다:
 * 피로 문장의 주 축이 학업인 주는 1,226건 중 212건뿐이었고, 학업 손실이 0인 주가 피로 21%·mood
 * 40%였다 — 그 주에 "책상 앞에 앉아 있어도"라고 말하면 거짓이다(3자 검수). 문장 회전 카운터도
 * (요인, 축) 칸 단위로 센다. 요인 단위로 세면 축이 번갈아 나올 때 한 칸이 짝수 번째만 받아
 * 2문장짜리 칸이 영영 첫 문장만 내는 모듈로 퇴화가 생긴다(project_modular_axis_degeneracy).
 */
export const AXIS_SPECIFIC_GROWTH_DRAGS: ReadonlySet<GrowthDragFactor> = new Set<GrowthDragFactor>(['fatigue', 'mood', 'freeCeiling', 'familiar']);

/**
 * 문장을 낼 만큼 컸는가 — 그 요인이 이번 주에 깎은 양(스탯 단위, 4축 합).
 * 근거: 활동으로 실제 오른 몫의 주간 중앙값이 0.72다. 1.0을 깎았다면 "한 주치 성장보다 더 잃은"
 * 손실이라 결과 숫자에서 체감된다. 피로가 1.0 이상 깎은 주는 22.0%, 0.5 이상은 29.8%였다.
 */
export const GROWTH_REASON_MIN_LOSS = 1.0;
/**
 * 이번 주 어느 축이든 이만큼 올랐으면 "왜 안 늘지?"라는 물음 자체가 없는 주다 — 문장을 내지 않는다.
 * 결산 독백의 "잘 늘었다" 풀(dialogues.ts)이 **같은 상수**로 켜진다. 같은 화면에서 독백은 "공부가
 * 손에 잡힌 한 주였다"고 하고 이 줄은 "피곤해서 집중하지 못했다"고 하면 두 화자가 반대로 말한다.
 */
export const GOOD_WEEK_AXIS_GAIN = 1.5;
/**
 * 잘 는 주에도 말할 수 있는 요인 — 주당 상한은 **오를 만큼 다 오른 주에만** 걸린다(축이 +2를 채워야
 * 깎인다). 그래서 잘 는 주를 일괄 제외하면 이 문장은 구조적으로 영영 못 나온다(실측 0회). 그리고
 * "꽉 찼다, 더 몰아넣어도 안 남는다"는 "손에 잡힌 한 주였다"와 모순되지 않는다 — 오히려 그 주의 해설이다.
 */
export function compatibleWithGoodWeek(factor: GrowthDragFactor): boolean {
  return factor === 'weeklyCap';
}
/** 어떤 문장이든 낸 뒤 이 주 수만큼은 아무 문장도 내지 않는다. */
export const GROWTH_REASON_GAP_WEEKS = 4;
/** 같은 날씨 요인을 다시 말하기까지 */
export const GROWTH_REASON_SITUATIONAL_REPEAT_WEEKS = 8;
/** 같은 지형 요인을 다시 말하기까지 — 한 해 */
export const GROWTH_REASON_STRUCTURAL_REPEAT_WEEKS = 48;

/** 판정 결과 — 로그에 박힌다. variant는 그 문장 칸이 몇 번째로 나온 것인지(문장 회전용). */
export interface GrowthReason {
  factor: GrowthDragFactor;
  axis: GrowthAxis;
  variant: number;
}

/** 판정 사이의 기억 — 간격과 문장 회전. 구세이브에는 없다(= 아직 한 번도 안 냄). */
export interface GrowthReasonMemo {
  /** 마지막으로 문장을 낸 주의 totalWeeksPlayed */
  lastShownAt: number;
  /** 요인별 마지막으로 낸 주 */
  lastByFactor: Partial<Record<GrowthDragFactor, number>>;
  /** 문장 칸(growthReasonCell)별로 지금까지 낸 횟수 */
  shown: Record<string, number>;
}

export function sumDrag(ledger: GrowthLedger, factor: GrowthDragFactor): number {
  const row = ledger.drag[factor];
  if (!row) return 0;
  let s = 0;
  for (const v of Object.values(row)) s += v ?? 0;
  return s;
}

const AXES: readonly GrowthAxis[] = ['academic', 'talent', 'health', 'social'];

/** 그 요인에서 가장 많이 깎인 축 */
function topAxis(ledger: GrowthLedger, factor: GrowthDragFactor): GrowthAxis {
  const row = ledger.drag[factor] ?? {};
  let best: GrowthAxis = AXES[0];
  let bestV = -Infinity;
  for (const axis of AXES) {
    const v = row[axis] ?? 0;
    if (v > bestV) { best = axis; bestV = v; }
  }
  return best;
}

/** 문장 칸 — 회전 카운터의 키. 축별 문장을 쓰는 요인만 축까지 가른다. */
export function growthReasonCell(factor: GrowthDragFactor, axis: GrowthAxis): string {
  return AXIS_SPECIFIC_GROWTH_DRAGS.has(factor) ? `${factor}:${axis}` : factor;
}

/** 간격·임계를 보기 전의 원시 판정 — 가장 많이 깎은 요인(측정용). 손실이 없으면 null. */
export function dominantGrowthDrag(ledger: GrowthLedger | undefined): { factor: GrowthDragFactor; loss: number } | null {
  if (!ledger) return null;
  let best: GrowthDragFactor | null = null;
  let bestLoss = 0;
  for (const factor of GROWTH_DRAG_FACTORS) {
    const loss = sumDrag(ledger, factor);
    if (loss > bestLoss) { best = factor; bestLoss = loss; }
  }
  return best ? { factor: best, loss: bestLoss } : null;
}

/** 그 요인을 이 주에 말해도 되는가(요인별 재발 간격) */
function factorRested(memo: GrowthReasonMemo | undefined, factor: GrowthDragFactor, weekIndex: number): boolean {
  const last = memo?.lastByFactor[factor];
  if (last === undefined) return true;
  const gap = STRUCTURAL_GROWTH_DRAGS.has(factor)
    ? GROWTH_REASON_STRUCTURAL_REPEAT_WEEKS
    : GROWTH_REASON_SITUATIONAL_REPEAT_WEEKS;
  return weekIndex - last >= gap;
}

/**
 * 그 주의 주 원인 판정 — **순수함수, 유일한 판정 지점**. memo는 읽기만 하고 갱신은
 * `advanceGrowthReasonMemo`가 한다.
 * @param weekIndex 이번 주의 totalWeeksPlayed(증가 전)
 */
export function pickGrowthReason(
  ledger: GrowthLedger | undefined,
  statChanges: WeekLog['statChanges'],
  memo: GrowthReasonMemo | undefined,
  weekIndex: number,
): GrowthReason | null {
  if (!ledger) return null;
  if (memo && weekIndex - memo.lastShownAt < GROWTH_REASON_GAP_WEEKS) return null;
  const goodWeek = AXES.some(axis => (statChanges[axis] ?? 0) >= GOOD_WEEK_AXIS_GAIN);
  let best: GrowthDragFactor | null = null;
  let bestLoss = 0;
  for (const factor of GROWTH_DRAG_FACTORS) {
    if (goodWeek && !compatibleWithGoodWeek(factor)) continue;
    const loss = sumDrag(ledger, factor);
    if (loss < GROWTH_REASON_MIN_LOSS || !factorRested(memo, factor, weekIndex)) continue;
    if (loss > bestLoss) { best = factor; bestLoss = loss; }
  }
  if (!best) return null;
  const axis = topAxis(ledger, best);
  return { factor: best, axis, variant: memo?.shown[growthReasonCell(best, axis)] ?? 0 };
}

export function advanceGrowthReasonMemo(
  memo: GrowthReasonMemo | undefined,
  reason: GrowthReason,
  weekIndex: number,
): GrowthReasonMemo {
  const cell = growthReasonCell(reason.factor, reason.axis);
  return {
    lastShownAt: weekIndex,
    lastByFactor: { ...(memo?.lastByFactor ?? {}), [reason.factor]: weekIndex },
    shown: { ...(memo?.shown ?? {}), [cell]: (memo?.shown[cell] ?? 0) + 1 },
  };
}

// ===== 손상값 정규화 · 표시 판정 =====
//
// memo와 로그의 판정은 세이브에 실린다. 손상된 값이 들어오면(실측, 3자 검수) `{}`·`shown: null`은
// 매주 TypeError로 주 확정을 막고, `lastShownAt`이 거대값·문자열이면 영원히 침묵하고, `shown`이
// 문자열이면 "1"+1 = "11"로 이어 붙는다. 보류분(sanitizePendingWeekDelta, #453/#454)과 같은 원칙 —
// 거부가 아니라 정규화: 숫자 아닌 값은 버리고, 구조가 안 맞으면 memo를 통째로 지운다(잃는 건 문장
// 회전 위치뿐이다).

const isFiniteNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isFactor = (x: unknown): x is GrowthDragFactor =>
  typeof x === 'string' && (GROWTH_DRAG_FACTORS as readonly string[]).includes(x);
const isAxis = (x: unknown): x is GrowthAxis =>
  typeof x === 'string' && (AXES as readonly string[]).includes(x);

/** 유효한 문장 칸 키 전부 — `shown`의 키는 이 안에 있어야 한다. */
const VALID_CELLS: ReadonlySet<string> = new Set(
  GROWTH_DRAG_FACTORS.flatMap(f => AXES.map(a => growthReasonCell(f, a))),
);

/**
 * @param now 그 판의 totalWeeksPlayed — 미래 좌표(lastShownAt > now)는 영구 침묵을 만드는 손상값이다.
 */
export function sanitizeGrowthReasonMemo(v: unknown, now: unknown): GrowthReasonMemo | undefined {
  if (!isPlainObject(v)) return undefined;
  const ceiling = isFiniteNum(now) ? now : Infinity;
  const inRange = (x: unknown): x is number => isFiniteNum(x) && x >= 0 && x <= ceiling;
  if (!inRange(v.lastShownAt)) return undefined;
  const lastByFactor: GrowthReasonMemo['lastByFactor'] = {};
  if (isPlainObject(v.lastByFactor)) {
    for (const [k, x] of Object.entries(v.lastByFactor)) if (isFactor(k) && inRange(x)) lastByFactor[k] = x;
  }
  const shown: GrowthReasonMemo['shown'] = {};
  if (isPlainObject(v.shown)) {
    for (const [k, x] of Object.entries(v.shown)) {
      if (VALID_CELLS.has(k) && isFiniteNum(x) && x >= 0) shown[k] = Math.floor(x);
    }
  }
  return { lastShownAt: v.lastShownAt, lastByFactor, shown };
}

/** 로그에 박힌 판정의 정규화 — 모르는 요인·축, 정수 아닌 variant면 판정이 없는 것으로 본다. */
export function sanitizeGrowthReason(v: unknown): GrowthReason | undefined {
  if (!isPlainObject(v)) return undefined;
  if (!isFactor(v.factor) || !isAxis(v.axis)) return undefined;
  if (!isFiniteNum(v.variant) || v.variant < 0 || !Number.isInteger(v.variant)) return undefined;
  return { factor: v.factor, axis: v.axis, variant: v.variant };
}

/**
 * 결산에 **실제로 보일** 둔화 판정 — 화면과 결산 독백이 함께 쓰는 유일한 판정(SSOT).
 *
 * 엔진 판정은 processWeek 시점의 statChanges로 했다. 그런데 같은 주의 이벤트 몫이 결산 **뒤에**
 * 로그로 접힌다(store foldOutcomeIntoWeekLog). 그 몫으로 축이 크게 올랐다면 변화량 표는 큰 상승을
 * 보여 주는데 줄은 "피곤해서 집중 못 했다"가 된다. 그래서 **최종** statChanges로 잘 는 주인지 다시
 * 묻고, 잘 는 주면 물러선다(주당 상한만 예외 — compatibleWithGoodWeek).
 */
export function visibleGrowthReason(log: WeekLog | null | undefined): GrowthReason | null {
  if (!log) return null;
  const reason = sanitizeGrowthReason(log.growthReason);
  if (!reason) return null;
  const changes = isPlainObject(log.statChanges) ? log.statChanges as WeekLog['statChanges'] : {};
  const goodWeek = AXES.some(axis => { const v = changes[axis]; return isFiniteNum(v) && v >= GOOD_WEEK_AXIS_GAIN; });
  if (goodWeek && !compatibleWithGoodWeek(reason.factor)) return null;
  return reason;
}

/** 이 주 결산에 "좋았다"와 반대로 말하는 둔화 줄이 보이는가 — 결산 독백이 물러설지 정한다. */
export function slowdownShown(log: WeekLog | null | undefined): boolean {
  const r = visibleGrowthReason(log);
  return r != null && !compatibleWithGoodWeek(r.factor);
}
