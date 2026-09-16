/**
 * 시뮬 하네스가 공유하는 **루틴 정본**.
 *
 * 하네스마다 루틴을 따로 지어내면 같은 엔진을 재고도 정반대 결론이 나온다.
 * 2026-09-16 실사고: 표정 발주용 하네스가 루틴을 새로 만들어 쓰면서
 * `academy + online-lecture`로 돌렸는데 **`online-lecture`는 존재하지 않는 id**였다
 * (실제는 `internet-lecture`). 엔진은 못 찾은 슬롯을 조용히 스킵하므로
 * 주당 피로가 14 → 7로 반토막 난 채 돌았고, 주말·방학 선택도 비어 있었다.
 * 그 결과 tired 노출이 10.7%로 측정돼(정본 21.3%) **발주 장수 결정이 뒤집힐 뻔했다.**
 *
 * 그래서 두 가지를 여기서 구조적으로 막는다:
 *   ① 표를 한 벌만 둔다 — 하네스는 import만 한다.
 *   ② `assertRoutineIds()`가 카탈로그에 없는 id를 **실행 시점에 throw**한다.
 *      활동 id는 plain string이라 `tsc -b`도 `tsx`도 오타를 못 잡는다. 런타임 대조가 유일한 그물이다.
 */
import { ACTIVITIES } from '../../src/engine/activities';
import type { ParentStrength } from '../../src/engine/types';

export interface Routine {
  name: string;
  label: string;
  parents: [ParentStrength, ParentStrength];
  slot2: string;
  slot3: string;
  weekend: string[];
  vacation: string[];
}

// 대조군을 무료 루틴 하나로 두면 안 된다(과거 오판 전례) — 유료·혼합·무료 셋을 나란히 본다.
export const SIM_ROUTINES: Routine[] = [
  { name: 'paid', label: '유료 루틴(학원+헬스)', parents: ['strict', 'info'],
    slot2: 'academy', slot3: 'gym', weekend: ['self-study', 'club'], vacation: ['academy', 'rest', 'rest'] },
  { name: 'mixed', label: '혼합(학원+독학)', parents: ['emotional', 'info'],
    slot2: 'academy', slot3: 'self-study', weekend: ['club', 'rest'], vacation: ['self-study', 'club', 'rest'] },
  { name: 'free', label: '무료 루틴(독학+가벼운운동)', parents: ['resilience', 'freedom'],
    slot2: 'self-study', slot3: 'light-exercise', weekend: ['self-study', 'club'], vacation: ['rest', 'self-study', 'rest'] },
  // 지출형 — "유료 활동을 쓰고 싶은 플레이어"가 실제로 감당되는지. 여기서만 스킵이 관측된다.
  { name: 'paid-spend', label: '지출형(유료루틴+유료주말/방학)', parents: ['strict', 'info'],
    slot2: 'academy', slot3: 'gym', weekend: ['art-lesson', 'hang-out'], vacation: ['intensive-academy', 'sports-camp', 'rest'] },
  // 부모 wealth(+2만/주)가 지출형을 구제하는가.
  { name: 'paid-wealth', label: '지출형+부유한 부모(+2만/주)', parents: ['wealth', 'info'],
    slot2: 'academy', slot3: 'gym', weekend: ['art-lesson', 'hang-out'], vacation: ['intensive-academy', 'sports-camp', 'rest'] },
];

/**
 * 루틴이 참조하는 활동 id가 전부 카탈로그에 있는지 확인하고, 없으면 throw한다.
 * **하네스 맨 앞에서 부를 것.** 없는 id는 조용히 스킵되지 실패하지 않으므로,
 * 여기서 막지 않으면 "돌긴 돌았는데 절반만 적용된" 수치가 그대로 문서로 간다.
 */
export function assertRoutineIds(routines: readonly Routine[] = SIM_ROUTINES): void {
  const known = new Set(ACTIVITIES.map(a => a.id));
  if (known.size === 0) throw new Error('활동 카탈로그가 비었다 — 이 검사는 통과해도 의미가 없다');
  const bad: string[] = [];
  for (const r of routines) {
    for (const id of [r.slot2, r.slot3, ...r.weekend, ...r.vacation]) {
      if (!known.has(id)) bad.push(`${r.name}: ${id}`);
    }
  }
  if (bad.length > 0) {
    throw new Error(`존재하지 않는 활동 id — 슬롯이 조용히 스킵된다:\n  ${bad.join('\n  ')}`);
  }
}
