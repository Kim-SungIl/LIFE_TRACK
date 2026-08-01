// @vitest-environment jsdom
// 튜토리얼 앵커 계약: STEPS의 모든 data-tutorial 타겟이 주 계획 화면 DOM에 존재해야 한다.
// 앵커가 없으면 Tutorial은 중앙 폴백 카드로 조용히 강등되므로(지점 안내 유실) 여기서 잡는다.
// 특히 npc 카드는 지훈 met:true 초기값에 의존 — 초기값이 바뀌면 이 테스트가 깨진다.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MainWeekScreen } from '../screens/main/MainWeekScreen';
import { STEPS } from '../tutorialSteps';
import { makeState } from '../../test/fixtures';
import { getBackground } from '../../engine/backgrounds';

describe('튜토리얼 앵커', () => {
  it('STEPS의 모든 data-tutorial 타겟이 렌더된다', () => {
    localStorage.setItem('lifetrack_tutorial_done', '1'); // 오버레이 억제 — 앵커만 검증
    const noop = vi.fn();
    render(
      <MainWeekScreen
        state={makeState()}
        bgProps={{ bg: getBackground(1, false, 'good', 1), bgImgError: true, onImgError: noop }}
        onSetRoutine={noop}
        onTalkNpc={vi.fn(() => ({ kind: 'smalltalk', line: '' }) as never)}
        onTalkHome={vi.fn(() => ({ kind: 'smalltalk', line: '' }) as never)}
        onResolveParentChoice={noop}
        onBuyItem={noop}
        onConfirmWeek={noop}
      />,
    );
    for (const step of STEPS) {
      expect(
        document.querySelector(`[data-tutorial="${step.target}"]`),
        `앵커 누락: data-tutorial="${step.target}"`,
      ).not.toBeNull();
    }
  });
});
