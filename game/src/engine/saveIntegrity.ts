// 마이그레이션을 마친 세이브가 **게임을 돌릴 수 있는 모양인가**. (#447 후속)
//
// #447은 `loadSavedGame`을 try/catch로 감싸 "던지지 않고 false"를 만들었다. 그런데 그 방어는
// **마이그레이션 중 실제로 예외가 나는 손상만** 거른다. 예외가 안 나면 그대로 `set()` 되고,
// 호출부는 true를 받아 손상 안내를 띄우지 않는다.
//
// 실측(3자 검수에서 codex가 지적, 재현 확인):
//
//   parents: null (rngSeed 정상) -> threw=null ret=true state=SET
//   stats: null                  -> threw=null ret=true state=SET
//   npcs: null                   -> threw=null ret=true state=SET
//   stats가 문자열                -> threw=null ret=true state=SET
//
// #447의 테스트가 이걸 못 본 이유: `parents: null` 케이스를 **rngSeed까지 지운 채로만** 넣었다.
// 그러면 `rng.ts`의 `.join`이 터져 catch에 걸리지만, rngSeed가 멀쩡하면 아무 데서도 안 터져
// 그대로 통과한다. 방어가 아니라 **우연히 터지는 지점**에 기대고 있었던 것이다.
//
// **정규화가 아니라 거부다.** 펴서 살리면 플레이어가 고른 적 없는 부모·성별로 7년을 진행시킨다 —
// 못 여는 것보다 나쁘다. 이 판정은 "복구 가능한가"가 아니라 "이 값으로 게임이 성립하는가"만 본다.
import type { GameState, Gender, ParentStrength, StatKey } from './types';

const GENDERS = ['male', 'female'] as const satisfies readonly Gender[];

const STRENGTHS = [
  'wealth', 'info', 'resilience', 'emotional', 'freedom', 'strict',
] as const satisfies readonly ParentStrength[];

const PHASES = [
  'setup', 'weekday', 'weekend', 'vacation', 'result', 'event', 'semester-end', 'year-end', 'ending',
] as const satisfies readonly GameState['phase'][];

/**
 * 스탯 5축의 런타임 목록. **아래 `_MissingStatKey` 가드가 걸린 유일한 표라 여기가 SSOT다** —
 * `stateMigration`의 보류분 정규화도 이걸 쓴다(같은 표를 또 적으면 한쪽만 늙는다).
 */
export const STAT_KEYS = [
  'academic', 'social', 'talent', 'mental', 'health',
] as const satisfies readonly StatKey[];

/**
 * 컴파일 타임 완전성 가드.
 *
 * 유니온에 멤버가 추가되면 위 배열은 조용히 뒤처지고, 새 값을 가진 **정상 세이브가 "손상"으로
 * 거부된다** — 이 파일에서 가장 위험한 실패 모드다. 빠진 멤버가 있으면 여기서 타입 에러가 난다.
 *
 * **두 번 틀렸던 자리라 형태가 중요하다.**
 *
 * 1) 처음에는 `const _x: [_MissingPhase, ...] = [] as unknown as [never, ...]` 였다. 이건
 *    **원리적으로 위반될 수 없다** — `never`는 모든 타입에 대입 가능하므로 `_MissingPhase`가
 *    무엇이 되든 통과한다. 실측: `phase` 유니온에 `'epilogue'`를 넣어도 `tsc -b` rc=0,
 *    vitest 1301개 전부 초록. 가드가 지키겠다고 적어 둔 것을 한 번도 안 지키고 있었다.
 *    그래서 방향을 뒤집었다 — 이제 **`_Missing*`이 `never`에 대입되어야** 한다.
 *
 * 2) 그것만으로는 절반이다. `Exclude`의 리터럴 목록을 따로 적으면 표가 **두 층**이 되어,
 *    유니온 추가는 잡아도 배열에서 멤버를 **지우는 것**은 못 잡는다(실측: `PHASES`에서
 *    `'vacation'` 삭제 → tsc·전체 테스트 초록). 그래서 배열을 SSOT로 두고 `typeof X[number]`로
 *    파생시킨다. 이제 어느 쪽을 건드려도 한 곳에서 걸린다.
 *
 * 양방향 실측:
 *   정상                      → rc=0
 *   PHASES에서 'vacation' 삭제 → rc=2  Type '[never, never, "vacation", never]' …
 *   유니온에 'epilogue' 추가   → rc=2  Type '[never, never, "epilogue", never]' …
 */
type _MissingGender = Exclude<Gender, typeof GENDERS[number]>;
type _MissingStrength = Exclude<ParentStrength, typeof STRENGTHS[number]>;
type _MissingPhase = Exclude<GameState['phase'], typeof PHASES[number]>;
type _MissingStatKey = Exclude<StatKey, typeof STAT_KEYS[number]>;
const _exhaustive: [never, never, never, never] =
  [] as unknown as [_MissingGender, _MissingStrength, _MissingPhase, _MissingStatKey];
void _exhaustive;

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * 못 쓰는 이유를 돌려준다(진단용). 쓸 수 있으면 `null`.
 *
 * **마이그레이션 뒤에 부른다.** 구세이브의 빠진 필드는 `migrateLoadedState`가 백필하므로,
 * 그 전에 부르면 정상 세이브를 거부한다.
 */
export function describeUnplayable(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return 'state가 객체가 아니다';
  const s = state as Record<string, unknown>;

  if (typeof s.gender !== 'string' || !(GENDERS as readonly string[]).includes(s.gender)) return `gender=${JSON.stringify(s.gender)}`;
  if (typeof s.phase !== 'string' || !(PHASES as readonly string[]).includes(s.phase)) return `phase=${JSON.stringify(s.phase)}`;

  // 부모 2종. 마이그레이션이 'gene' 별칭을 이미 폈으므로 여기서는 최종 이름만 본다.
  if (!Array.isArray(s.parents) || s.parents.length !== 2) return `parents=${JSON.stringify(s.parents)}`;
  if (!s.parents.every(p => typeof p === 'string' && (STRENGTHS as readonly string[]).includes(p))) {
    return `parents 값=${JSON.stringify(s.parents)}`;
  }

  // 스탯 5축 — 하나라도 숫자가 아니면 화면 전체가 NaN으로 물든다.
  if (typeof s.stats !== 'object' || s.stats === null || Array.isArray(s.stats)) {
    return `stats=${JSON.stringify(s.stats)}`;
  }
  const stats = s.stats as Record<string, unknown>;
  for (const k of STAT_KEYS) {
    if (!isFiniteNumber(stats[k])) return `stats.${k}=${JSON.stringify(stats[k])}`;
  }

  // NaN은 조용히 퍼진다 — 막대·등급·엔딩 판정이 전부 무의미해진다.
  for (const k of ['fatigue', 'money', 'year', 'week'] as const) {
    if (!isFiniteNumber(s[k])) return `${k}=${JSON.stringify(s[k])}`;
  }
  const { year, week } = s as { year: number; week: number };
  if (year < 1 || year > 8) return `year=${year}`;      // 8 = 엔딩 화면이 쓰는 값(#ending)
  if (week < 1 || week > 49) return `week=${week}`;     // 49 = week++ 직후의 경계

  // NPC 명부. `migrateLoadedState`가 `state.npcs || []`로 펴므로 null은 빈 배열로 도착한다 —
  // 그 상태로 열면 친구가 한 명도 없는 판이 된다(정상 판은 항상 명부를 갖는다).
  if (!Array.isArray(s.npcs) || s.npcs.length === 0) return `npcs=${Array.isArray(s.npcs) ? '빈 배열' : JSON.stringify(s.npcs)}`;

  return null;
}

/** `describeUnplayable`의 불린 판. */
export function isPlayableState(state: unknown): state is GameState {
  return describeUnplayable(state) === null;
}
