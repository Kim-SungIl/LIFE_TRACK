// @vitest-environment jsdom
// 엔딩 회상 테마의 **배선** 계약.
//
// bgm.test.ts는 곡과 스케줄러가 제대로 도는지를 본다. 그것만으로는 "모듈은 완벽한데 화면이
// 아무도 안 부르는" 상태가 통과한다 — EventResultScreen의 playSfx 한 줄을 지워도 39개가
// 전부 초록이던 전례가 있다(EventResultSound.test.tsx 참조).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { EndingScreen } from '../EndingScreen';
import { calculateEnding } from '../../../engine/ending';
import { getBackground } from '../../../engine/backgrounds';
import { makeState } from '../../../test/fixtures';
import { setBgmTrack, getBgmTrackId } from '../../../audio/bgm';

vi.mock('../../../audio/bgm', () => {
  let id = 'main';
  return {
    setBgmTrack: vi.fn((next: string) => { id = next; }),
    getBgmTrackId: vi.fn(() => id),
  };
});
// 진입음은 이 파일의 관심사가 아니다 — 실제 오디오를 건드리지 않게 막아 둔다.
vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));

const swaps = () =>
  (setBgmTrack as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(c => c[0]);

function renderEnding() {
  const state = makeState({ year: 7, week: 48 });
  return render(
    <EndingScreen
      ending={calculateEnding(state)}
      track={state.track}
      stats={state.stats}
      parents={state.parents}
      burnoutCount={0}
      // 배경은 실제 SSOT에서 뽑는다(수제 mock 금지). bgImgError=true라 이미지는 안 뜬다.
      bgProps={{
        bg: getBackground(state.week, false, 'normal', state.year),
        bgImgError: true,
        onImgError: vi.fn(),
      }}
      runDelta={null}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setBgmTrack('main');
  vi.clearAllMocks();
});

describe('엔딩 회상 테마 배선', () => {
  it('엔딩 화면이 뜨면 회상 테마로 갈아탄다', () => {
    renderEnding();
    expect(swaps()).toContain('endingRecall');
  });

  // 되돌리지 않으면 타이틀로 나가 새 판을 시작해도 엔딩 곡이 계속 흐른다.
  it('화면을 떠나면 원래 곡으로 되돌린다', () => {
    const { unmount } = renderEnding();
    expect(swaps()).toEqual(['endingRecall']);
    unmount();
    expect(swaps()).toEqual(['endingRecall', 'main']);
  });

  // "직전 곡은 항상 main"이라고 가정하면, 화면별 곡이 늘어나는 순간 엉뚱한 곡으로 되돌아간다.
  it('되돌릴 곡은 들어올 때의 곡이다 (main이라고 가정하지 않는다)', () => {
    setBgmTrack('endingRecall');       // 이미 회상 테마가 걸려 있는 상태로 진입
    vi.clearAllMocks();
    const { unmount } = renderEnding();
    unmount();
    expect(getBgmTrackId()).toBe('endingRecall');
  });

  // 이 화면에만 오디오 진입점이 없었다(타이틀·HUD에는 있다).
  it('오디오 토글이 화면에 있다', () => {
    const { getByLabelText } = renderEnding();
    expect(getByLabelText('소리 끄기')).toBeTruthy();
  });
});
