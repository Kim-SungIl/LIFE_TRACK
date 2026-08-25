// @vitest-environment jsdom
// 계획이 **낡아서** 감당 못 하게 된 주를 확정 전에 잡는지의 배선 계약.
//
// 이미 있는 방어: 활동을 고르는 순간에는 `ActivityPicker`가 막는다 — `availableMoney`가
// `state.money − routineCost − 이미 고른 활동 비용`이라(MainWeekScreen.tsx) 누적으로 본다.
// 감당 못 하는 활동은 '💰부족'으로 비활성이고 선택 자체가 안 된다.
//
// 남아 있던 구멍: 그 판정은 **고르는 순간**의 것이고, 고른 뒤 잔액이나 루틴이 바뀌어도 아무도
// 다시 보지 않았다. 그 상태로 확정하면 엔진이 조용히 건너뛰고 주간 결산에 "💰 돈이 부족해서
// …을 못 했다" 한 줄만 남는다. 플레이어는 슬롯을 채워 확정했는데 그 슬롯이 없던 일이 된다.
// phase를 바꾸지 않아 계획이 살아남는 경로가 셋 있다(전부 store가 state만 갱신):
//   ① 상점에서 물건을 산다 (같은 화면에서 바로 열린다)
//   ② 대화 미니이벤트가 돈을 쓴다 (talkData/miniEvents의 money: -1)
//   ③ 루틴을 바꾼다 — **수입 루틴이 끼어 있을 때만** 도달한다. 루틴 피커도 같은 누적
//      availableMoney를 받아 교체 대상 비용을 이중 차감하므로, 비용이 전부 양수면 교체로는
//      감당 못 하는 계획을 만들 수 없다(초기 버전의 테스트는 제품에 없는 상태를 가정했다).
//
// 판정 자체는 엔진이 하고(WeekLog.skipped, weekSkipRecord.test.ts) 이 파일은 **화면이 그걸
// 읽어 말하고 확정을 막는지**만 본다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MainWeekScreen } from '../MainWeekScreen';
import { makeState } from '../../../../test/fixtures';
import { getBackground } from '../../../../engine/backgrounds';
import { ACTIVITIES, getActivityCost, getAvailableActivities } from '../../../../engine/activities';
import type { GameState } from '../../../../engine/types';
import type { TalkActionResult } from '../../../../engine/store';

const NAME = (id: string) => ACTIVITIES.find(a => a.id === id)!.name;
const COST = (id: string, year = 1) => getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);

// JSX 속성으로 직접 넘길 때와 달리 객체를 spread하면 문맥 타이핑이 안 걸린다 → 함수 타입을 명시.
type ConfirmFn = (activities: string[], npcChoices: Record<string, string>) => void;

function screenProps(state: GameState, onConfirmWeek: ConfirmFn) {
  return {
    state,
    bgProps: {
      bg: getBackground(state.week, state.isVacation, state.mentalState, state.year),
      bgImgError: true, onImgError: () => {},
    },
    onSetRoutine: () => {},
    onTalkNpc: (): TalkActionResult => ({ kind: 'smalltalk', line: '' }),
    onTalkHome: (): TalkActionResult => ({ kind: 'smalltalk', line: '' }),
    onResolveParentChoice: () => {},
    onBuyItem: () => {},
    onConfirmWeek,
  };
}

// 엔진이 주차에서 방학을 재계산한다 — 픽스처의 isVacation과 week은 반드시 짝을 맞춘다.
const VACATION_WEEK = 21;

function renderScreen(patch: Partial<GameState> = {}) {
  const onConfirmWeek = vi.fn<ConfirmFn>();
  const state = makeState({
    isVacation: false, week: 3, money: 5,
    routineSlot2: 'self-study', routineSlot3: 'self-study',   // 무료 루틴 — 고를 때는 감당된다
    ...patch,
  });
  const utils = render(<MainWeekScreen {...screenProps(state, onConfirmWeek)} />);
  // 제품에서 상점 구매·대화·루틴 변경은 store를 갱신하고 이 화면은 새 state로 다시 그려진다.
  // 내부 selectedActivities(계획)는 그대로 남는다 — 그게 이 테스트가 겨냥하는 지점이다.
  const update = (p: Partial<GameState>) =>
    utils.rerender(<MainWeekScreen {...screenProps(makeState({ ...state, ...p }), onConfirmWeek)} />);
  return { onConfirmWeek, state, update };
}

const CAT_LABEL: Record<string, string> = {
  study: '공부', exercise: '운동', social: '관계', talent: '자기계발',
  rest: '휴식', parent: '가족', work: '알바',
};

/** 슬롯 편집 팝업을 열고 그 활동 버튼을 찾는다 — **누르지는 않는다**(비활성 여부 검사용). */
function openSlotFor(id: string, slotLabel: string) {
  const act = ACTIVITIES.find(a => a.id === id)!;
  fireEvent.click(screen.getByText(slotLabel).closest('button')!);
  const header = screen.getAllByRole('button').find(
    el => el.getAttribute('aria-expanded') !== null
      && (el.textContent ?? '').includes(CAT_LABEL[act.category]),
  );
  if (!header) throw new Error(`카테고리 헤더 없음: ${act.category}`);
  if (header.getAttribute('aria-expanded') === 'false') fireEvent.click(header);
  const btn = screen.getAllByRole('button').find(el =>
    el.getAttribute('aria-pressed') != null
    && !(el.textContent ?? '').includes('수치')
    && (el.textContent ?? '').includes(act.name));
  if (!btn) throw new Error(`활동 버튼 없음: ${act.name}`);
  return { act, btn };
}

/** 슬롯을 열어 활동을 고른다 — 실제 플레이 경로(슬롯 탭 → 편집 팝업 → 활동 버튼). */
function pickActivity(id: string, slotLabel = '토요일') {
  const { act, btn } = openSlotFor(id, slotLabel);
  expect(btn.hasAttribute('disabled'), `${act.name}이 이미 비활성이다 — 전제가 깨졌다`).toBe(false);
  fireEvent.click(btn);
  return act;
}

const warnText = () => screen.queryByText(/이번 주에 못 해요/);

beforeEach(() => {
  localStorage.clear();
  // 튜토리얼 오버레이는 클릭을 조용히 먹는다 — 반복 플레이어 상태로 고정.
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
});

describe('계획 화면 — 이미 있는 방어(고르는 순간)', () => {
  it('감당 못 하는 활동은 애초에 선택되지 않는다 (누적 판정)', () => {
    // 루틴 학원(2)+헬스(2) = 4, 잔액 5 → 루틴은 감당되지만 남는 건 1만.
    const { state } = renderScreen({ routineSlot2: 'academy', routineSlot3: 'gym' });
    expect(COST('academy') + COST('gym')).toBe(4);
    // 목록 자체(getAvailableActivities)는 활동 단위 조건이라 예체능을 걸러내지 못한다 —
    // 걸러내는 건 ActivityPicker의 availableMoney다. 그래서 이 전제가 성립한다.
    expect(getAvailableActivities(state).some(a => a.id === 'art-lesson')).toBe(true);

    fireEvent.click(screen.getByText('토요일').closest('button')!);
    const header = screen.getAllByRole('button').find(
      el => el.getAttribute('aria-expanded') !== null && (el.textContent ?? '').includes('자기계발'));
    if (header?.getAttribute('aria-expanded') === 'false') fireEvent.click(header);
    const btn = screen.getAllByRole('button').find(el =>
      el.getAttribute('aria-pressed') != null && (el.textContent ?? '').includes(NAME('art-lesson')));
    expect(btn?.hasAttribute('disabled'), '누적 판정이 사라졌다 — 못 살 것을 고를 수 있다').toBe(true);
    expect(btn?.textContent).toContain('💰부족');
  });
});

describe('계획 화면 — 낡은 계획(고른 뒤 사정이 바뀐 경우)', () => {
  it('① 활동을 고른 뒤 돈이 줄면 경고하고 확정을 막는다 (상점·미니이벤트)', () => {
    const { onConfirmWeek, update } = renderScreen();
    pickActivity('art-lesson');
    expect(warnText(), '고른 직후엔 감당된다').toBeNull();

    update({ money: 1 });   // 상점 구매 또는 대화 미니이벤트(money -1)로 잔액이 줄어든 셈

    const warn = warnText();
    expect(warn, '잔액이 줄었는데 아무 말도 없다 — 그 슬롯이 조용히 날아간다').toBeTruthy();
    // 어느 활동인지 이름을 대야 한다 — 슬롯 라벨에도 같은 이름이 있으므로 경고 안에서 찾는다.
    expect(warn!.textContent, '경고가 활동 이름을 안 댄다').toContain(NAME('art-lesson'));
    const btn = screen.getByRole('button', { name: /돈이 부족한 활동이 있어요/ });
    expect(btn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(btn);
    expect(onConfirmWeek, '못 하는 활동을 담은 주가 확정됐다').not.toHaveBeenCalled();
  });

  it('② 수입 루틴을 유료 루틴으로 바꾸면 경고한다 (루틴이 먼저 차감된다)', () => {
    // 도달 경로: Y6 잔액 5, 루틴=편의점 알바(수입 4). 고르는 순간 availableMoney는
    // 5 − (−4) = 9라 입시 실기(4)가 선택된다. 그 뒤 루틴을 학원(4)으로 바꾸면 교체 시점
    // availableMoney는 5 − (−4) − 4 = 5로 여전히 통과한다 → 확정하면 총 8만이 필요해진다.
    const { update } = renderScreen({ year: 6, money: 5, routineSlot2: 'part-time', routineSlot3: null });
    expect(COST('part-time', 6)).toBeLessThan(0);
    pickActivity('practical-lesson');
    expect(warnText(), '수입 루틴 상태에서는 감당된다').toBeNull();

    update({ routineSlot2: 'academy' });   // 알바(−4) → 학원(+4)

    // 루틴 자체는 감당된다(5 ≥ 4) → 기존 루틴 경고는 안 뜬다. 남는 1만으로 실기(4)를 못 한다.
    expect(screen.queryByText(/돈이 부족해요! 방과후/), '루틴 경고가 대신 뜨면 이 테스트가 무의미하다').toBeNull();
    const warn = warnText();
    expect(warn, '루틴 변경 뒤 선택 슬롯을 다시 보지 않는다').toBeTruthy();
    expect(warn!.textContent).toContain(NAME('practical-lesson'));
  });

  it('③ 수입 루틴이 섞여 합계로는 감당되는데 순차로는 루틴이 실패하면, 루틴 이름을 댄다', () => {
    // 학원(4) + 알바(−4) = 0이라 기존 루틴 경고(합계 판정)는 뜨지 않는다. 그런데 엔진은
    // 순차로 차감하므로 잔액 1만에서는 학원이 실행되지 않는다 — 예전에는 이걸 "루틴 id"라는
    // 이유로 걸러내 경고가 아예 없었다.
    // 학년 4: 중등 학원 3만 + 알바 −3만이 정확히 상쇄된다(고등은 알바가 −4만이라 합계가 음수).
    renderScreen({ year: 4, money: 1, routineSlot2: 'academy', routineSlot3: 'part-time' });
    expect(COST('academy', 4) + COST('part-time', 4)).toBe(0);

    expect(screen.queryByText(/돈이 부족해요! 방과후/), '합계 기반 루틴 경고가 뜨면 전제가 다르다').toBeNull();
    const warn = warnText();
    expect(warn, '루틴이 조용히 스킵되는데 아무 말도 없다').toBeTruthy();
    expect(warn!.textContent).toContain(NAME('academy'));
  });

  it('방학에도 경고하고 확정을 막는다 — 고액 활동이 몰린 구간', () => {
    // 방학은 슬롯이 5칸이고 특강 5·캠프 5·가족여행 8만이 있는 구간이다. 학기 렌더만 검사하면
    // 방학 경로를 통째로 빼먹어도 테스트가 그린이 된다(실제로 그랬다).
    const { onConfirmWeek, update } = renderScreen({
      isVacation: true, week: VACATION_WEEK, money: 5,
      routineSlot2: null, routineSlot3: null,
    });
    expect(COST('intensive-academy')).toBe(5);
    pickActivity('intensive-academy', '활동 1');
    expect(warnText(), '고른 직후엔 감당된다').toBeNull();

    update({ money: 1 });

    const warn = warnText();
    expect(warn, '방학에는 경고가 아예 없다').toBeTruthy();
    expect(warn!.textContent).toContain(NAME('intensive-academy'));
    const btn = screen.getByRole('button', { name: /돈이 부족한 활동이 있어요/ });
    expect(btn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(btn);
    expect(onConfirmWeek, '방학에서는 못 하는 활동을 담은 주가 확정된다').not.toHaveBeenCalled();
  });

  it('여러 활동이 걸리면 전부 이름을 댄다 — 하나만 고쳐도 못 넘어간다', () => {
    // 방학 5칸에 예체능(2) 둘 + 특강(5) 하나. 잔액이 줄면 둘 이상이 동시에 못 돈다.
    const { update } = renderScreen({
      isVacation: true, week: VACATION_WEEK, money: 9,
      routineSlot2: null, routineSlot3: null,
    });
    pickActivity('intensive-academy', '활동 1');
    pickActivity('art-lesson', '활동 3');
    expect(warnText()).toBeNull();

    update({ money: 1 });

    const warn = warnText();
    expect(warn).toBeTruthy();
    expect(warn!.textContent, '첫 항목만 말하면 나머지는 조용히 날아간다')
      .toContain(NAME('intensive-academy'));
    expect(warn!.textContent).toContain(NAME('art-lesson'));
    // 나열 구분자 — 이름을 이어 붙이기만 하면 읽을 수 없다.
    expect(warn!.textContent).toContain('·');
  });

  it('감당되는 계획은 그대로 확정된다', () => {
    const { onConfirmWeek } = renderScreen();
    pickActivity('art-lesson');

    expect(warnText()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /이번 주 확정/ }));
    expect(onConfirmWeek).toHaveBeenCalledTimes(1);
    expect(onConfirmWeek.mock.calls[0][0]).toContain('art-lesson');
  });

  it('루틴 경고가 떠 있을 때는 루틴 문구만 낸다 (고칠 곳을 하나로)', () => {
    const { update } = renderScreen();
    pickActivity('art-lesson');
    update({ money: 1, routineSlot2: 'academy', routineSlot3: 'gym' });   // 루틴 4만도 못 낸다

    expect(screen.getByText(/돈이 부족해요! 방과후/)).toBeTruthy();
    expect(warnText(), '두 경고가 동시에 떴다').toBeNull();
  });
});

// 같은 "낡은 계획" 결함군의 두 번째 갈래 — 경고 문구가 아니라 **계획 자체를 잃어버리는** 쪽.
//
// 화면은 이미 고른 활동을 해석할 때 카탈로그(ACTIVITIES)를 봐야 한다. `getAvailableActivities`는
// "지금 고를 수 있는가"라 `requires`에 잔액 조건이 섞여 있어서(academy·gym·art-lesson·
// internet-lecture·study-room·supplementary-class·practical-lesson·private-tutoring), 그걸로
// 해석하면 고른 **뒤** 잔액이 떨어졌을 때 이미 배치된 활동이 조용히 사라진다. 슬롯 배열에는
// 남아 있으니 화면상 슬롯은 채워진 채다. 엔진은 ACTIVITIES로 해석하므로(gameEngine의
// applyWeekendActivities) 계획은 실제로 살아 있고, 어긋나는 건 화면의 파생값 셋이다.
//
// 돈 게이트가 걸린 활동은 전부 1칸이라 유실 폭은 인스턴스당 1칸이다 — 그래서 경계를 정확히
// 맞춘 픽스처가 필요하다(아래 각 테스트의 산식 주석).
describe('계획 화면 — 낡은 계획이 파생값을 무너뜨리지 않는다 (계획은 카탈로그로 해석)', () => {
  it('① 슬롯 용량: 잔액이 떨어져도 사라진 칸만큼 초과 배치되지 않는다 (방학)', () => {
    // 방학 5칸을 1칸짜리 유료 활동 넷으로 채운다: 예체능2 + 헬스2 + 학원2 + 인강1 = 7만.
    // 고르는 동안 누적 availableMoney는 7→5→3→1이라 마지막 인강(1만)까지 정확히 들어간다.
    const { update } = renderScreen({
      isVacation: true, week: VACATION_WEEK, money: 7,
      routineSlot2: null, routineSlot3: null,
    });
    // 전제: 방학 슬롯이 5칸이다(부모 보너스가 붙으면 이 테스트의 경계 산식이 깨진다).
    expect(screen.queryByText('활동 5'), '방학 슬롯이 5칸이 아니다').toBeTruthy();
    expect(screen.queryByText('활동 6'), '방학 슬롯이 6칸 이상이다 — 경계 산식을 다시 잡아라').toBeNull();
    expect(COST('art-lesson') + COST('gym') + COST('academy') + COST('internet-lecture')).toBe(7);

    pickActivity('art-lesson', '활동 1');
    pickActivity('gym', '활동 2');
    pickActivity('academy', '활동 3');
    pickActivity('internet-lecture', '활동 4');

    update({ money: 0 });   // 상점 구매 등으로 잔액 소진 — 넷 다 requires를 잃는다

    // 남은 건 5번 한 칸. 3칸짜리 시골/할머니댁은 들어갈 자리가 없다(4 + 3 > 5).
    // 계획을 잃어버리면 currentSlots가 0으로 보여 5칸이 통째로 비어 있는 셈이 된다.
    const { act, btn } = openSlotFor('countryside', '활동 5');
    expect(act.slots, '3칸 활동이라야 경계가 성립한다').toBe(3);
    expect(btn.hasAttribute('disabled'), '계획을 잃어 빈 칸으로 보인다 — 5칸에 7칸을 배치할 수 있다')
      .toBe(true);
    // 비활성 사유가 돈이 아니라 슬롯이어야 한다 — 시골/할머니댁은 무료다.
    expect(btn.textContent, '무료 활동인데 돈 때문에 막혔다 — 다른 경로가 걸린 것이다')
      .not.toContain('💰부족');
  });

  it('② 누적 돈 게이트: 잔액이 떨어지면 남은 슬롯의 유료 활동이 막힌다', () => {
    // 이 게이트는 PR #407이 "고르는 순간의 방어"로 명시적으로 의존하는 것이다. 계획을 잃으면
    // 이미 고른 활동의 비용이 availableMoney에서 빠져 게이트가 통째로 헐거워진다.
    const { update } = renderScreen();
    pickActivity('art-lesson');           // 2만, 잔액 5 → availableMoney 3

    update({ money: 1 });                 // 예체능(2만)이 requires를 잃는다

    // 올바른 값: 1 − 루틴0 − 예체능2 = −1 → 인강(1만)도 못 산다.
    // 잃어버리면: 1 − 0 − 0 = 1 → 인강이 살 수 있는 것으로 보인다.
    const { btn } = openSlotFor('internet-lecture', '일요일');
    expect(btn.hasAttribute('disabled'), '이미 고른 활동의 비용이 누적에서 빠졌다 — 못 살 것을 고를 수 있다')
      .toBe(true);
    expect(btn.textContent, '막히긴 했는데 돈 때문이 아니다 — 슬롯 등 다른 이유면 이 계약이 무의미하다')
      .toContain('💰부족');
  });

  it('③ 빈 주말 판정: 계획이 살아 있는데 "주말은 쉰다"고 말하지 않는다', () => {
    // 수입 루틴을 끼워야 이 증상이 격리된다. 엔진은 루틴을 먼저 처리하므로(알바 +4만)
    // 선택 슬롯 차례엔 잔액이 5만이라 예체능(2만)이 **실제로 실행된다** → 돈 경고가 안 뜬다.
    // 반면 화면의 requires 판정은 state.money(1만)만 보므로 계획만 사라진다. 경고 문구가
    // 빈 주말 문구보다 우선하기 때문에(확정 버튼 라벨 분기), 경고가 없는 이 상태라야 검사된다.
    const { onConfirmWeek, update } = renderScreen({
      year: 6, money: 5, routineSlot2: 'part-time', routineSlot3: null,
    });
    expect(COST('part-time', 6), '수입 루틴이어야 이 경로가 성립한다').toBeLessThan(0);
    pickActivity('art-lesson');

    update({ money: 1 });

    expect(warnText(), '엔진이 실행하는데 못 한다고 경고한다 — 이 테스트의 전제가 깨졌다').toBeNull();
    expect(
      screen.queryByText('주말 활동을 선택하지 않으면 자동으로 휴식합니다.'),
      '계획이 살아 있는데 아무것도 안 골랐다고 안내한다',
    ).toBeNull();

    // 확정 버튼이 "쉰다"로 바뀌면 플레이어는 쉬는 줄 알고 누르는데 실제로는 예체능을 한다.
    const btn = screen.getByRole('button', { name: /이번 주 확정|주말은 쉰다/ });
    expect(btn.textContent, '쉰다고 해놓고 계획은 그대로 넘긴다').toContain('이번 주 확정');
    fireEvent.click(btn);
    expect(onConfirmWeek).toHaveBeenCalledTimes(1);
    expect(onConfirmWeek.mock.calls[0][0], '화면이 잃어버린 활동을 엔진은 받는다')
      .toContain('art-lesson');
  });

  it('④ 감당 못 하게 된 활동을 슬롯에서 교체할 수 있다 (반쪽 수정 방지)', () => {
    // MainWeekScreen만 고치고 SlotEditPopup을 두면 새 잠금이 생긴다: 편집 중인 슬롯의 활동을
    // 되돌려주는 계산(currentSlots − editingSlots)도 같은 목록을 보기 때문에, 감당 못 하게 된
    // 활동이 0칸으로 잡혀 그 칸이 반환되지 않는다 → 그 활동을 **뺄 수도 없다**.
    // 경계: 예체능1 + 창작2 = 3칸. 편집 슬롯이 1칸을 돌려주면 2 + 시골3 = 5로 딱 들어가고,
    // 안 돌려주면 3 + 3 = 6으로 막힌다.
    const { update } = renderScreen({
      isVacation: true, week: VACATION_WEEK, money: 2,
      routineSlot2: null, routineSlot3: null,
    });
    pickActivity('art-lesson', '활동 1');
    pickActivity('creative-project', '활동 2');

    update({ money: 1 });   // 예체능이 requires를 잃는다

    const { btn } = openSlotFor('countryside', '활동 1');
    expect(btn.hasAttribute('disabled'), '감당 못 하게 된 활동이 슬롯에 갇혔다 — 뺄 수도 바꿀 수도 없다')
      .toBe(false);
  });
});
