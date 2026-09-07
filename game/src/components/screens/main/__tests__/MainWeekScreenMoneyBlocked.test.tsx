// @vitest-environment jsdom
// T25 — "돈 때문에 이번 주 계획을 확정하지 못했다"를 **화면이 알리는지**의 배선 계약.
//
// 판정 주체가 화면인 이유: 그 주는 확정되지 않으므로 processWeek에 도달하지 않는다.
// 엔진의 WeekLog.skipped(money)로 세려던 첫 판이 제품에서 상시 0이 된 것이 이 때문이었다
// (confirmDisabled가 그 기록을 읽어 확정을 막는다). 그래서 회고의 '쪼들림' 축은 이 콜백이
// 살아 있는 동안만 존재한다 — 여기서 잠근다.
//
// 막히는 경로는 둘이고 **둘 다 잠근다**: 루틴 고정비를 못 내는 경우와, 고른 활동이 순차
// 차감에서 떨어지는 경우다. 실측상 후자가 훨씬 흔하다(지출형 연 34.8주의 대부분).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MainWeekScreen } from '../MainWeekScreen';
import { makeState } from '../../../../test/fixtures';
import { getBackground } from '../../../../engine/backgrounds';
import { ACTIVITIES, getActivityCost } from '../../../../engine/activities';
import type { GameState } from '../../../../engine/types';
import type { TalkActionResult } from '../../../../engine/store';

const NAME = (id: string) => ACTIVITIES.find(a => a.id === id)!.name;
const COST = (id: string, year = 1) => getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);
const CAT_LABEL: Record<string, string> = {
  study: '공부', exercise: '운동', social: '관계', talent: '자기계발',
  rest: '휴식', parent: '가족', work: '알바',
};

function props(state: GameState, onMoneyBlocked: () => void) {
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
    onConfirmWeek: () => {},
    onMoneyBlocked,
  };
}

function renderScreen(patch: Partial<GameState> = {}) {
  const cb = vi.fn();
  const state = makeState({ isVacation: false, week: 3, money: 5, ...patch });
  const utils = render(<MainWeekScreen {...props(state, cb)} />);
  // 상점 구매·미니이벤트·루틴 변경은 store만 갱신하고 화면은 새 state로 다시 그려진다 —
  // 내부 selectedActivities(계획)는 그대로 살아남는다. 그게 '낡은 계획' 경로다.
  const update = (p: Partial<GameState>) =>
    utils.rerender(<MainWeekScreen {...props(makeState({ ...state, ...p }), cb)} />);
  return { cb, update };
}

/** 슬롯을 열어 활동을 고른다 — 실제 플레이 경로(슬롯 탭 → 편집 팝업 → 활동 버튼). */
function pickActivity(id: string, slotLabel = '토요일') {
  const act = ACTIVITIES.find(a => a.id === id)!;
  fireEvent.click(screen.getByText(slotLabel).closest('button')!);
  const header = screen.getAllByRole('button').find(
    el => el.getAttribute('aria-expanded') !== null
      && (el.textContent ?? '').includes(CAT_LABEL[act.category]),
  );
  if (header?.getAttribute('aria-expanded') === 'false') fireEvent.click(header);
  const btn = screen.getAllByRole('button').find(el =>
    el.getAttribute('aria-pressed') != null
    && !(el.textContent ?? '').includes('수치')
    && (el.textContent ?? '').includes(act.name));
  if (!btn) throw new Error(`활동 버튼 없음: ${act.name}`);
  expect(btn.hasAttribute('disabled'), `${act.name}이 이미 비활성이다 — 전제가 깨졌다`).toBe(false);
  fireEvent.click(btn);
}

beforeEach(() => {
  localStorage.clear();
  // 튜토리얼 오버레이는 클릭을 조용히 먹고 jsdom에 없는 scrollIntoView를 부른다 — 반복 플레이어로 고정.
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_tutorial_done', '1');
});

describe('MainWeekScreen — 돈 때문에 확정이 막힌 주를 알린다', () => {
  it('루틴 고정비를 못 내면 알린다', () => {
    // 착지값 먼저 — 비용이 바뀌면 이 픽스처는 "돈 부족"이 아니게 된다.
    expect(COST('academy')).toBe(2);
    const { cb } = renderScreen({ money: 1, routineSlot2: 'academy', routineSlot3: null });
    expect(cb).toHaveBeenCalled();
  });

  // 실플레이에서 더 흔한 쪽. 이 케이스가 없으면 unaffordable 분기를 지워도 전부 초록이다.
  it('고른 활동이 돈으로 떨어지면 알린다 (낡은 계획)', () => {
    expect(COST('self-study')).toBe(0);
    expect(COST('art-lesson')).toBe(2);
    const { cb, update } = renderScreen({ money: 5, routineSlot2: 'self-study', routineSlot3: null });
    pickActivity('art-lesson');
    expect(cb, '고른 직후엔 감당되므로 알릴 것이 없다').not.toHaveBeenCalled();

    update({ money: 1 });   // 상점 구매나 미니이벤트(money -1)로 잔액이 줄어든 셈

    // 화면이 실제로 그 주를 막았는지 먼저 확인 — 안 막혔으면 아래 단언은 아무것도 잠그지 않는다.
    const blockBtn = screen.getByRole('button', { name: /돈이 부족한 활동이 있어요/ });
    expect(blockBtn.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText(/이번 주에 못 해요/)?.textContent).toContain(NAME('art-lesson'));
    expect(cb, '확정이 돈 때문에 막혔는데 회고에 알리지 않았다').toHaveBeenCalled();
  });

  // 양성 짝 — 감당되는 주에 알리면 회고가 전부 '쪼들림'으로 물든다.
  it('감당되는 주에는 알리지 않는다', () => {
    const { cb } = renderScreen({ money: 50, routineSlot2: 'academy', routineSlot3: null });
    expect(cb).not.toHaveBeenCalled();
  });

  it('무료 루틴이면 알리지 않는다', () => {
    const { cb } = renderScreen({ money: 0, routineSlot2: 'self-study', routineSlot3: null });
    expect(cb).not.toHaveBeenCalled();
  });

  // 확정이 막히는 이유는 셋인데(루틴 미설정·루틴 고정비·고른 활동), 돈이 아닌 것을 세면
  // 첫 주부터 모든 판이 '쪼들림'이 된다.
  it('루틴 미설정으로 확정이 막힌 것은 돈이 아니다', () => {
    const { cb } = renderScreen({ money: 50, routineSlot2: null, routineSlot3: null });
    expect(cb).not.toHaveBeenCalled();
  });
});
