// @vitest-environment jsdom
// 선택지의 "(이미 낸 OO 빠짐)" **배선** — 이벤트 선택이 한 달 등록으로 이미 낸 학원을 빼먹게 하면 화면이 미리 말한다.
//
// 판정(monthlyMoney.prepaidRoutineSkippedBy)은 monthlyMoney.test.ts가 잠근다. 그 함수를 화면이 실제로 부르는지는
// 별개라(#397: 훅을 잠가도 App이 부르는지는 별개) 여기서 EventScene을 렌더해 문구를 직접 본다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventScene } from '../EventScene';
import { makeChoice, makeEvent } from '../../test/fixtures';
import { createInitialState } from '../../engine/gameEngine';
import { payMonthStart } from '../../engine/monthlyMoney';
import type { GameState } from '../../engine/types';

vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));

function paidState(prepaid: boolean): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 3 });
  Object.assign(s, {
    year: 2, week: 5, phase: 'event' as const, isVacation: false,
    routineSlot2: 'academy', routineSlot3: 'gym', money: 100,
  });
  if (prepaid) payMonthStart(s);
  return s;
}

const event = makeEvent({
  id: 'prepaid-skip-probe',
  description: '짧은 설명.',
  choices: [
    makeChoice({ text: '"가자!" — 방과후에 농구하러 간다', timeCost: 1 }),
    makeChoice({ text: '거절한다' }),
  ],
});

describe('이미 낸 학원을 빼먹는 선택지', () => {
  it('선불한 달이면 timeCost 선택지에 "(이미 낸 헬스/PT 빠짐)"이 붙는다 — 그 선택지에만', () => {
    render(<EventScene event={event} gender="male" year={2} state={paidState(true)} onChoice={vi.fn()} />);
    const tags = screen.getAllByTestId('prepaid-skip');
    expect(tags).toHaveLength(1);
    expect(tags[0].textContent).toBe('(이미 낸 헬스/PT 빠짐)');
    expect(tags[0].closest('button')?.textContent).toContain('농구');
  });

  it('아직 안 낸 달이면 붙지 않는다 (음성 짝)', () => {
    render(<EventScene event={event} gender="male" year={2} state={paidState(false)} onChoice={vi.fn()} />);
    expect(screen.queryByTestId('prepaid-skip')).toBeNull();
  });
});
