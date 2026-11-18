// @vitest-environment jsdom
// 결과 화면의 `{season}` 배경 해석 — CG가 없거나 실패했을 때 뒤에 깔리는 배경이 사건이 열린 주의 계절을 따르는가.
// EventScene은 인게임 실측(2026-11-18)으로 봤지만, 결과 화면 배경은 CG가 있는 만남에선 대체 경로라 화면으로 못 본다.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EventResultScreen } from '../EventResultScreen';
import type { EventResultData } from '../shared';
import type { GameEvent } from '../../../engine/types';

vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));

const parkEvent = { id: 'test-park-season', title: 't', description: '', choices: [], location: 'park', background: 'park_{season}' } as unknown as GameEvent;

function bgSrc(week: number | undefined, data: Partial<EventResultData> = {}) {
  const { container } = render(
    <EventResultScreen
      gender="female" year={6} week={week}
      eventResultData={{ message: '결과', effects: [], event: parkEvent, choiceIndex: 0, ...data } as EventResultData}
      cgLoaded={false} cgError onCgLoaded={vi.fn()} onCgError={vi.fn()} onContinue={vi.fn()}
    />,
  );
  return container.querySelector('img[data-bg-idx]')?.getAttribute('src') ?? '';
}

describe('결과 화면 계절 배경', () => {
  it('넘겨받은 주의 계절 그림을 쓴다(겨울방학 W45 → 겨울, 여름방학 W22 → 여름)', () => {
    expect(bgSrc(45)).toContain('images/backgrounds/park_winter.');
    expect(bgSrc(22)).toContain('images/backgrounds/park_summer.');
  });

  it('사건 자체에 고정 주가 있으면 그것이 먼저다', () => {
    expect(bgSrc(45, { event: { ...parkEvent, week: 30 } as GameEvent })).toContain('images/backgrounds/park_autumn.');
  });
});
