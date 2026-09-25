/**
 * QA 플레이스루 페르소나 — 타입과 **제품 유효성 판정기**.
 *
 * 왜 필요한가(T47 실측): sim-qa-playthrough의 31종 중 14종이 **제품에서는 만들 수 없는 조합**이었다.
 *   (a) 부모 강점 동일 5종 — TitleScreen.tsx의 `toggle`은 이미 고른 강점을 다시 누르면 **해제**하고
 *       (selected.includes → filter), lastSetup.ts `validated()`도 `normalized[0] === normalized[1]`을 거부한다.
 *   (b) 주중 루틴 슬롯2 = 슬롯3 6종 — SlotEditPopup.tsx:85-86이 routine2 후보에서 routineSlot2를 빼고,
 *       routine1에서 슬롯3과 같은 id를 고르면 슬롯3을 비운다(onToggle, :102).
 *   (c) 돈이 모자란 주의 유료 활동 8종 — 이건 정적으로 못 가른다(잔액은 판마다 다르다).
 *       그래서 매주 UI 규칙을 재현해 세는 쪽(qa-ui-week-gates.ts)이 맡는다.
 * 93판(3시드)에서 (a)(b)를 빼면 번아웃 24.7 → 11.8%, S 67.7 → 70.6%다 — 위반 표본이 헤드라인을
 * 2배 부풀렸다. **페르소나를 지우지는 않는다.** 극단 스트레스 표본(엔진이 C를 내는지, 번아웃 락이
 * 실패 엔딩으로 라우팅되는지, 동일 강점 2배 배율의 상한)으로서 값이 있다. 다만 유효 표본과
 * **섞어 세면** 안 된다 — 하네스 요약은 유효/위반 두 표로 가른다.
 *
 * 위 규칙은 컴포넌트 안에만 있다(toggle 클로저·JSX filter·onToggle 콜백) — 함수로 못 부르므로
 * 여기 **최소 복제**한다. 카탈로그 부재 id 검사는 scripts/lib/sim-routines.ts의 assertRoutineIds와
 * 같은 이유다(엔진은 못 찾은 슬롯을 조용히 스킵하고, 활동 id는 plain string이라 tsc가 못 잡는다).
 */
import { ACTIVITIES } from '../../../src/engine/activities';
import type { ParentStrength } from '../../../src/engine/types';

export type ChoicePolicy = 'first' | 'academic' | 'social' | 'talent' | 'mental' | 'health' | 'balanced' | 'last' | 'axis-min';

export interface Persona {
  name: string;
  label: string;          // 사람이 읽는 설명
  gender: 'male' | 'female';
  parents: [ParentStrength, ParentStrength];
  routineSlot2: string;   // '' = 슬롯 비움 (엔진이 falsy를 "루틴 없음"으로 읽는다, gameEngine.ts:833)
  routineSlot3: string;   // 학기 중 슬롯2는 제품에서 필수다(MainWeekScreen.tsx) — 최소투입은 슬롯3만 비운다
  weekend: string[];
  vacation: string[];
  policy: ChoicePolicy;
  talk?: boolean;        // 매주 친밀도 최상위 NPC에게 말걸기 (미니톡/tier 측정)
  talkFocus?: string;    // 설정 시 그 NPC에게만 집중 말걸기 (focused ceiling 측정)
  companionFocus?: string; // 주말/방학 동행 활동(+3)을 이 NPC에게 몰빵 (met 이후부터)
  companionSpread?: boolean; // 동행을 최저 친밀도 met NPC에게 분산 (전원 친구 상한 측정)
  tutoringY6?: boolean;  // Y6+ 주말 슬롯에 집중과외 투입 (돈 sink 측정)
  // 알바 밸브 측정 — part-time은 unlockYear 4(중3)이고 requires도 year>=4다(activities.ts:216).
  // processWeek는 돈만 보고 unlock/requires를 안 보므로 tutoringY6과 동일하게 **하네스에서 수동 게이트**한다.
  // 이 게이트를 빼면 Y1~Y3에 존재하지 않는 수입이 생겨 측정 자체가 거짓이 된다.
  partTimeY4?: boolean;        // Y4+ 주말 1슬롯을 알바로 (Y1~3은 p.weekend 그대로)
  partTimeVacationY4?: boolean; // Y4+ 방학 1슬롯도 알바로 (밸브 상한 측정)
  /**
   * **제품에서 만들 수 없는 조합임을 안다**는 표시. 이유는 적지 않는다 — 이유는 validatePersona가
   * 낸다(손으로 적으면 규칙과 드리프트한다). 표시와 판정이 어긋나면 하네스가 기동을 거부하고
   * 테스트(qaSimHonesty.test)가 빨강이다 — 새 위반 페르소나가 조용히 유효 표에 섞이지 못하게.
   */
  invalid?: true;
}

/**
 * 제품 UI가 만들 수 없는 조합의 사유 목록. 빈 배열이면 유효.
 * 순수함수 — 카탈로그(ACTIVITIES)만 읽는다.
 */
export function validatePersona(p: Persona): string[] {
  const reasons: string[] = [];

  // (a) TitleScreen.tsx:136-141 toggle — 같은 강점을 두 번 못 고른다. lastSetup.ts validated()도 거부.
  if (p.parents[0] === p.parents[1]) {
    reasons.push(`부모 강점 동일(${p.parents[0]}×2) — TitleScreen toggle이 못 만들고 lastSetup이 거부`);
  }

  // MainWeekScreen.tsx confirmDisabled — 학기 중 슬롯2가 비면 확정이 잠긴다(매주).
  if (!p.routineSlot2) {
    reasons.push('루틴 슬롯2 비움 — 학기 중 확정 버튼이 잠긴다(MainWeekScreen confirmDisabled)');
  }

  // (b) SlotEditPopup.tsx:85-86 — routine2 후보에서 routineSlot2를 뺀다. routine1에서 슬롯3과 같은
  //     id를 고르면 슬롯3이 비워진다(:102). 어느 순서로 골라도 같은 id 2칸은 불가능.
  if (p.routineSlot2 && p.routineSlot2 === p.routineSlot3) {
    reasons.push(`루틴 슬롯2=슬롯3(${p.routineSlot2}) — SlotEditPopup이 후보에서 제외`);
  }

  // 루틴 후보는 `slots === 1 && category !== 'rest'`(SlotEditPopup.tsx:85)뿐이다.
  for (const [slot, id] of [['슬롯2', p.routineSlot2], ['슬롯3', p.routineSlot3]] as const) {
    if (!id) continue;
    const act = ACTIVITIES.find(a => a.id === id);
    if (!act) {
      reasons.push(`루틴 ${slot} '${id}' — 카탈로그(ACTIVITIES)에 없는 id(엔진이 조용히 스킵)`);
      continue;
    }
    if (act.category === 'rest') reasons.push(`루틴 ${slot} '${id}' — rest 계열은 루틴 후보에서 제외(SlotEditPopup)`);
    if (act.slots !== 1) reasons.push(`루틴 ${slot} '${id}' — ${act.slots}칸 활동은 루틴 후보에서 제외(SlotEditPopup)`);
  }

  // 주말·방학은 같은 활동 중복이 제품에서도 가능하다(SlotEditPopup:113 "같은 활동 중복 가능") — id 존재만 본다.
  for (const [where, ids] of [['주말', p.weekend], ['방학', p.vacation]] as const) {
    for (const id of ids) {
      if (id && !ACTIVITIES.some(a => a.id === id)) {
        reasons.push(`${where} '${id}' — 카탈로그(ACTIVITIES)에 없는 id(엔진이 조용히 스킵)`);
      }
    }
  }

  return reasons;
}

/** 표시(invalid)와 판정이 어긋난 페르소나 — 하네스 기동 거부·테스트 빨강의 근거. */
export function personaMarkMismatches(personas: readonly Persona[]): string[] {
  const out: string[] = [];
  for (const p of personas) {
    const reasons = validatePersona(p);
    if (reasons.length > 0 && p.invalid !== true) out.push(`${p.name}: 위반인데 invalid 표시가 없다 — ${reasons.join(' / ')}`);
    if (reasons.length === 0 && p.invalid === true) out.push(`${p.name}: invalid 표시가 있는데 유효하다(표시가 낡았다)`);
  }
  return out;
}
