// 직전 판의 **시작 설정**. "같은 집에서 다시"의 입력이고, 그게 전부다.
//
// **왜 세이브(lifetrack_save)에서 읽지 않는가**: 그러면 다회차 입구가 세이브 포맷과
// 마이그레이션에 묶인다. 이 값은 진행 상태가 아니라 "지난번에 무엇을 골랐나"라서
// has_cleared / rest_ack / tutorial_ever_seen과 같은 계열의 **작은 영속 플래그**로 둔다.
// 세이브가 지워져도(엔딩 후 새 판) 남아야 하는 값이라는 점에서도 세이브와 수명이 다르다.
//
// **왜 아카이브(lifetrack_archive)에 넣지 않는가**: 아카이브는 "지금까지의 모든 판"의
// 이야기 커버리지이고 스키마가 버전 관리된다(CURRENT_ARCHIVE_VERSION). 여기에 시작 설정을
// 얹으면 커버리지 계산과 무관한 필드가 버전 격상에 끼어든다.
//
// **이월되는 것은 설정뿐이다.** 스탯·돈·친밀도는 절대 넘기지 않는다 — 그건 다회차 축이
// 아니라 밸런스 파괴다(5그룹 논의 만장일치). npcPeak은 아카이브에 이미 있지만 게임플레이가
// 읽지 않는 원천 데이터이고, 그 성질을 여기서도 유지한다.
import type { Gender, ParentStrength } from './types';

const LAST_SETUP_KEY = 'lifetrack_last_setup';

export interface LastSetup {
  gender: Gender;
  parents: [ParentStrength, ParentStrength];
  /** 도전 모드(자연 회복 감소). 선택 화면을 건너뛰는 입구라 이 값도 함께 물려받는다. */
  useReducedRecovery: boolean;
}

const GENDERS = ['male', 'female'] as const satisfies readonly Gender[];
const STRENGTHS = ['wealth', 'info', 'resilience', 'emotional', 'freedom', 'strict'] as const satisfies readonly ParentStrength[];

// **강점을 하나 추가하면 여기서 tsc가 막는다.** 이 배열은 ParentStrength 유니언의 손 사본이라,
// 검증용이라는 이유로 누락되면 그 강점을 고른 사람에게서만 입구가 조용히 사라진다
// (읽기가 null을 내고 화면이 평소 흐름으로 접히므로 에러도 안 난다).
// never가 아니면 "유니언에는 있는데 이 배열엔 없는 값"이 있다는 뜻이다.
type MissingStrength = Exclude<ParentStrength, (typeof STRENGTHS)[number]>;
const _allStrengthsListed: MissingStrength extends never ? true : never = true;
void _allStrengthsListed;

/**
 * 새 판이 시작될 때 기록한다. 호출 지점은 store.startGame 한 곳 —
 * 새 판의 유일한 진입점이라 입구를 몇 개 만들어도 기록 지점은 늘지 않는다.
 */
export function saveLastSetup(setup: LastSetup): void {
  try {
    localStorage.setItem(LAST_SETUP_KEY, JSON.stringify({
      gender: setup.gender,
      parents: [setup.parents[0], setup.parents[1]],
      useReducedRecovery: !!setup.useReducedRecovery,
    }));
  } catch { /* storage unavailable — 입구가 하나 줄어들 뿐이므로 조용히 넘어간다 */ }
}

/**
 * 성별·부모 검증. **두 출처(스토리지 키 · 세이브 state)가 이 함수 하나를 쓴다** —
 * 검증을 각자 두면 한쪽에만 규칙이 추가되어, 같은 설정이 한 입구에서는 통과하고
 * 다른 입구에서는 막히는 상태가 된다(실제로 그런 적이 있다 — deriveSetup 주석 참조).
 * useReducedRecovery만 출처마다 규칙이 달라서 **판정을 끝낸 boolean으로 받는다**.
 */
function validated(gender: unknown, parents: unknown, useReducedRecovery: boolean): LastSetup | null {
  if (typeof gender !== 'string' || !(GENDERS as readonly string[]).includes(gender)) return null;
  // 길이 2를 요구한다 — createInitialState의 시그니처가 튜플이고, 1개나 3개를 받아
  // 슬라이스하면 플레이어가 고른 적 없는 조합이 만들어진다.
  if (!Array.isArray(parents) || parents.length !== 2) return null;
  if (!parents.every((v): v is ParentStrength => typeof v === 'string'
    && (STRENGTHS as readonly string[]).includes(v))) return null;
  // 같은 강점 2개는 선택 UI가 만들 수 없는 조합이다(toggle이 중복을 막는다).
  // 조작된 스토리지에서만 나오고, 통과시키면 "같은 집"이라 적힌 화면이
  // 플레이어가 고른 적 없는 집을 시작한다.
  if (parents[0] === parents[1]) return null;
  return {
    gender: gender as Gender,
    parents: [parents[0], parents[1]] as [ParentStrength, ParentStrength],
    useReducedRecovery,
  };
}

/**
 * 읽기. **검증에 실패하면 null이다** — 부분 복구를 하지 않는다.
 * 반쯤 맞는 설정으로 판을 시작하면 "같은 집"이라고 말하면서 다른 집에서 시작하는 셈이 된다.
 * null이면 입구가 평소의 성별→기억 선택 흐름으로 되돌아가므로 잃는 것은 편의뿐이다.
 */
export function loadLastSetup(): LastSetup | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(LAST_SETUP_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    // **boolean이어야 한다.** saveLastSetup이 항상 `!!`로 써 넣으므로, 없거나 다른 타입이면
    // 이 키를 쓴 게 아니라 손상·조작된 값이다. false로 접으면 도전 모드로 끝낸 사람이
    // "같은 집에서 다시 · 도전 모드"가 아닌 일반 모드로 시작하게 되고, 화면은 여전히
    // "지난 판과 같은 부모"라고 말한다 — 이 모듈의 전부-아니면-없음 규칙에 난 유일한 구멍이었다.
    if (typeof o.useReducedRecovery !== 'boolean') return null;
    return validated(o.gender, o.parents, o.useReducedRecovery);
  } catch { return null; }
}

/**
 * deriveSetup의 입력. GameState를 그대로 받되 **선언 타입을 믿지 않는다** —
 * 세이브는 JSON.parse 결과에 캐스트만 씌운 값이라 손상·구버전 세이브가 여기로 들어온다.
 */
export interface SetupSource {
  readonly gender: unknown;
  readonly parents?: unknown;
  readonly useReducedRecovery?: unknown;
}

/**
 * **세이브 state에서 시작 설정을 뽑는다 — 키가 없는 사람을 위한 경로다.**
 * 이 기능이 배포되기 전에 시작한 판에는 `lifetrack_last_setup`이 없지만, 그 판의 설정은
 * state 안에 gender·parents·useReducedRecovery로 그대로 들어 있다.
 *
 * 엔딩 화면은 처음부터 이 근거를 썼고(GameScreen), **타이틀만 키를 못 찾아 곧장 성별 선택으로
 * 보냈다** — 같은 사람이 엔딩에서는 "같은 집에서 다시"를 보고, 타이틀로 나갔다 오면 그 갈래가
 * 사라지는 상태였다. 두 입구가 이 함수 하나를 쓰게 해서 한쪽만 고쳐진 상태를 없앤다.
 */
export function deriveSetup(state: SetupSource | null | undefined): LastSetup | null {
  if (!state) return null;
  // **useReducedRecovery만 loadLastSetup과 규칙이 다르다: 여기서는 없는 것이 정상이다.**
  // GameState에서 선택 필드(`useReducedRecovery?: boolean`)이고, 도전 모드 도입 전에 시작한
  // 세이브에는 아예 없다 — 그건 손상이 아니라 "꺼짐"이다. 스토리지 키 쪽은 항상 써 넣으므로
  // 없으면 손상인 것과 정반대다. 규칙이 다른 이유가 여기 있으니 한쪽에 맞추지 말 것.
  return validated(state.gender, state.parents, state.useReducedRecovery === true);
}

/** 테스트·초기화용. 제품 코드에는 호출부가 없다(설정은 판을 시작할 때만 바뀐다). */
export function clearLastSetup(): void {
  try { localStorage.removeItem(LAST_SETUP_KEY); } catch { /* noop */ }
}
