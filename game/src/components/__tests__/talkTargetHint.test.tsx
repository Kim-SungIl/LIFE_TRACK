// @vitest-environment jsdom
// UX 재확인 U2 — "지난달 못 다한 이야기 N"은 친밀도 30+·남은 이야기가 있는 친구(와 가정)에게만 줄어드는데,
// 화면은 "친구·가족에게 말을 걸면"이라고만 해 누구에게 말을 걸어야 하는지 알 길이 없었다.
// 띠 안내문·친구 카드·친구 관계 창이 같은 판정(npcsToContinueTalk)으로 그 친구를 가리킨다.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MainWeekScreen } from '../screens/main/MainWeekScreen';
import { TUTORIAL_KEYS } from '../tutorialSteps';
import { createInitialState } from '../../engine/gameEngine';
import { getAvailableNpcEvents } from '../../engine/talkSystem';
import { getBackground } from '../../engine/backgrounds';
import { getMonthBlock } from '../../engine/weekMath';
import type { GameState } from '../../engine/types';

const noop = () => {};

function stateWithBank(npc: number): { s: GameState; friend: string; friendName: string } {
  const s = Object.assign(createInitialState('male', ['emotional', 'info'], { rngSeed: 42 }), {
    phase: 'weekday' as const, currentEvent: null, routineSlot2: 'self-study', routineSlot3: null,
  });
  s.npcEventPendingThisWeek = false;
  s.parentEventPendingThisWeek = false;
  const probe = { ...s, npcEventPendingThisWeek: true };
  const target = s.npcs.find(n => { n.met = true; n.intimacy = 60; return getAvailableNpcEvents(probe, n.id).length > 0; });
  if (!target) throw new Error('전제: 미니 이벤트가 남은 친구');
  // 나머지는 30 밑 — 표시는 target 하나여야 한다.
  for (const n of s.npcs) if (n.id !== target.id && n.met) n.intimacy = 20;
  s.talkBank = { year: s.year, month: getMonthBlock(s.week).index, npc, home: 0 };
  return { s, friend: target.id, friendName: target.name };
}

function renderMain(s: GameState, talkBank: number) {
  localStorage.setItem(TUTORIAL_KEYS.everSeen, '1');
  localStorage.setItem(TUTORIAL_KEYS.done, '1');
  return render(
    <MainWeekScreen
      state={s}
      bgProps={{ bg: getBackground(1, false, 'good', 1), bgImgError: true, onImgError: noop }}
      onSetRoutine={noop}
      onTalkNpc={vi.fn(() => ({ kind: 'smalltalk', line: '' }) as never)}
      onTalkHome={vi.fn(() => ({ kind: 'smalltalk', line: '' }) as never)}
      onResolveParentChoice={noop}
      onBuyItem={noop}
      onConfirmWeek={noop}
      monthly={{ hasPlan: false, stopLine: null, talkBank, onOpenPlan: noop, onAutoPlay: () => null }}
    />,
  );
}

describe('못 다한 이야기 — 누구에게 이어서 할지 화면이 가리킨다', () => {
  it('talk_target_named: 띠 안내문·친구 카드·관계 창이 그 친구를 가리킨다', () => {
    const { s, friend, friendName } = stateWithBank(1);
    renderMain(s, 1);
    const entry = screen.getByTestId('month-plan-entry');
    expect(entry.textContent, 'talk_target_named: 띠').toContain(`${friendName}에게 말을 걸면`);
    const card = screen.getByRole('button', { name: /친구 \d+명/ });
    expect(card.textContent, 'talk_target_named: 친구 카드').toMatch(new RegExp(`💬 ${friendName}(와|과) 할 이야기`));
    fireEvent.click(card);
    const sheet = screen.getByRole('dialog', { name: '친구 관계' });
    expect(within(sheet).getByTestId(`npc-continue-${friend}`)).toBeInTheDocument();
    expect(within(sheet).getAllByText('💬 이어서 할 이야기가 있어요')).toHaveLength(1);
  });

  it('talk_target_none: 적립이 없으면 카드·관계 창에 표시가 없다', () => {
    const { s } = stateWithBank(0);
    renderMain(s, 0);
    const card = screen.getByRole('button', { name: /친구 \d+명/ });
    expect(card.textContent, 'talk_target_none').not.toContain('할 이야기');
    fireEvent.click(card);
    expect(screen.queryByText('💬 이어서 할 이야기가 있어요')).not.toBeInTheDocument();
  });
});
