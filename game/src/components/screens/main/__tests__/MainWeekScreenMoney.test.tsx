// @vitest-environment jsdom
// 계획이 **낡아서** 감당 못 하게 된 주를 확정 전에 잡는지의 계약.
//
// 이미 있는 방어: 활동을 고르는 순간에는 `ActivityPicker`가 막는다 — `availableMoney`가
// `state.money − routineCost − 이미 고른 활동 비용`이라(MainWeekScreen.tsx:347) 누적으로 본다.
// 감당 못 하는 활동은 '💰부족'으로 비활성이고 선택 자체가 안 된다.
//
// 남아 있던 구멍: 그 판정은 **고르는 순간**의 것이고, 고른 뒤 잔액이나 루틴이 바뀌어도 아무도
// 다시 보지 않았다. 그 상태로 확정하면 엔진이 조용히 건너뛰고(gameEngine.ts:806) 주간 결산에
// "💰 돈이 부족해서 …을 못 했다" 한 줄만 남는다. 플레이어는 슬롯을 채워 확정했는데 그 슬롯이
// 없던 일이 된다. 실제로 닿는 경로가 둘 있다:
//   ① 활동을 고른 뒤 상점에서 물건을 산다 (같은 화면에서 바로 열린다)
//   ② 활동을 고른 뒤 루틴을 더 비싼 것으로 바꾼다 (루틴은 나중에 차감되지만 먼저 빠져나간다)
// 아래 테스트는 두 경로를 state prop 갱신으로 재현한다(제품에서 store가 그렇게 갱신한다).
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

function renderScreen(patch: Partial<GameState> = {}) {
  const onConfirmWeek = vi.fn<ConfirmFn>();
  const state = makeState({
    isVacation: false, week: 3, money: 5,
    routineSlot2: 'self-study', routineSlot3: 'self-study',   // 무료 루틴 — 고를 때는 감당된다
    ...patch,
  });
  const utils = render(<MainWeekScreen {...screenProps(state, onConfirmWeek)} />);
  // 제품에서 상점 구매·루틴 변경은 store를 갱신하고 이 화면은 새 state로 다시 그려진다.
  // 내부 selectedActivities(계획)는 그대로 남는다 — 그게 이 테스트가 겨냥하는 지점이다.
  const update = (p: Partial<GameState>) =>
    utils.rerender(<MainWeekScreen {...screenProps(makeState({ ...state, ...p }), onConfirmWeek)} />);
  return { onConfirmWeek, state, update };
}

const CAT_LABEL: Record<string, string> = {
  study: '공부', exercise: '운동', social: '관계', talent: '자기계발',
  rest: '휴식', parent: '가족', work: '알바',
};

/** 토요일 슬롯을 열어 활동을 고른다 — 실제 플레이 경로(슬롯 탭 → 편집 팝업 → 활동 버튼). */
function pickWeekendActivity(id: string) {
  const act = ACTIVITIES.find(a => a.id === id)!;
  fireEvent.click(screen.getByText('토요일').closest('button')!);
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
  it('① 활동을 고른 뒤 상점에서 돈을 쓰면 경고하고 확정을 막는다', () => {
    const { onConfirmWeek, update } = renderScreen();
    pickWeekendActivity('art-lesson');
    expect(warnText(), '고른 직후엔 감당된다').toBeNull();

    update({ money: 1 });   // 상점에서 4만어치를 산 셈

    const warn = warnText();
    expect(warn, '잔액이 줄었는데 아무 말도 없다 — 그 슬롯이 조용히 날아간다').toBeTruthy();
    // 어느 활동인지 이름을 대야 한다 — 슬롯 라벨에도 같은 이름이 있으므로 경고 안에서 찾는다.
    expect(warn!.textContent, '경고가 활동 이름을 안 댄다').toContain(NAME('art-lesson'));
    const btn = screen.getByRole('button', { name: /돈이 부족한 활동이 있어요/ });
    expect(btn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(btn);
    expect(onConfirmWeek, '못 하는 활동을 담은 주가 확정됐다').not.toHaveBeenCalled();
  });

  it('② 활동을 고른 뒤 루틴을 비싼 것으로 바꾸면 경고한다 (루틴이 먼저 차감된다)', () => {
    const { update } = renderScreen();
    pickWeekendActivity('art-lesson');

    update({ routineSlot2: 'academy', routineSlot3: 'gym' });   // 루틴 0 → 4만

    // 루틴 자체는 감당된다(5 ≥ 4) → 기존 루틴 경고는 안 뜬다. 남는 1만으로 예체능(2)을 못 한다.
    expect(screen.queryByText(/돈이 부족해요! 방과후/), '루틴 경고가 대신 뜨면 이 테스트가 무의미하다').toBeNull();
    expect(warnText(), '루틴 변경 뒤 선택 슬롯을 다시 보지 않는다').toBeTruthy();
  });

  it('감당되는 계획은 그대로 확정된다', () => {
    const { onConfirmWeek } = renderScreen();
    pickWeekendActivity('art-lesson');

    expect(warnText()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /이번 주 확정/ }));
    expect(onConfirmWeek).toHaveBeenCalledTimes(1);
    expect(onConfirmWeek.mock.calls[0][0]).toContain('art-lesson');
  });

  it('루틴 경고가 떠 있을 때는 루틴 문구만 낸다 (고칠 곳을 하나로)', () => {
    const { update } = renderScreen();
    pickWeekendActivity('art-lesson');
    update({ money: 1, routineSlot2: 'academy', routineSlot3: 'gym' });   // 루틴 4만도 못 낸다

    expect(screen.getByText(/돈이 부족해요! 방과후/)).toBeTruthy();
    expect(warnText(), '두 경고가 동시에 떴다').toBeNull();
  });
});
