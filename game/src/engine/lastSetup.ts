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

const GENDERS: readonly string[] = ['male', 'female'];
const STRENGTHS: readonly string[] = ['wealth', 'info', 'resilience', 'emotional', 'freedom', 'strict'];

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
    if (typeof o.gender !== 'string' || !GENDERS.includes(o.gender)) return null;
    const p = o.parents;
    // 길이 2를 요구한다 — createInitialState의 시그니처가 튜플이고, 1개나 3개를 받아
    // 슬라이스하면 플레이어가 고른 적 없는 조합이 만들어진다.
    if (!Array.isArray(p) || p.length !== 2) return null;
    if (!p.every(v => typeof v === 'string' && STRENGTHS.includes(v))) return null;
    return {
      gender: o.gender as Gender,
      parents: [p[0], p[1]] as [ParentStrength, ParentStrength],
      useReducedRecovery: o.useReducedRecovery === true,
    };
  } catch { return null; }
}

/** 테스트·초기화용. 제품 코드에는 호출부가 없다(설정은 판을 시작할 때만 바뀐다). */
export function clearLastSetup(): void {
  try { localStorage.removeItem(LAST_SETUP_KEY); } catch { /* noop */ }
}
