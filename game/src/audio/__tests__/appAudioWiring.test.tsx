// @vitest-environment jsdom
// 오디오 훅이 **App에 실제로 마운트되는가**.
//
// audio.test.ts / bgm.test.ts는 훅을 직접 걸어(Harness) 동작을 잠근다. 훅 자체는 그것으로
// 충분하지만, **App이 그 훅을 부르지 않으면 제품에는 그 기능이 없다.** 그리고 그 상태가
// 전부 초록이었다 — 뮤테이션으로 확인했다:
//
//   · App.tsx에서 useAudioUnlock() 삭제 → 547개 테스트 전부 통과.
//     오디오가 영원히 잠겨 **게임 전체가 무음**이 되는데도 아무도 실패하지 않는다.
//   · App.tsx에서 useAudioLifecycle() 삭제 → 전부 통과.
//     탭을 떠나도 배경음이 계속 흐르는데 아무도 실패하지 않는다.
//
// 같은 층위 착오를 최근에 두 번 더 겪었다(#389 폰트 CSS import 미잠금, #390 이미지 래핑
// 소스 스캔). 결론은 매번 같다 — **배선은 배선을 지나가 봐야 잠긴다.**
// 그래서 이 파일은 훅을 직접 부르지 않는다. 진짜 <App />을 렌더하고 실제 이벤트를 던진다.
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import App from '../../App';
import {
  getBgmTarget, isAudioRunning, setBgmEnabled, __resetAudioForTest,
} from '../audioEngine';
import { isBgmPlaying, __resetBgmForTest } from '../bgm';

interface StubState { state: string; suspendCalls: number; resumeCalls: number }

function installStub() {
  const makeParam = () => ({
    setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(), value: 0,
  });
  class StubCtx {
    state = 'running';
    currentTime = 0;
    sampleRate = 44100;
    suspendCalls = 0;
    resumeCalls = 0;
    destination = {};
    createGain() { return { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn() }; }
    createOscillator() {
      return {
        type: 'sine' as OscillatorType,
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null,
      };
    }
    createBiquadFilter() {
      return {
        type: 'lowpass' as BiquadFilterType, frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(), disconnect: vi.fn(),
      };
    }
    createBuffer(_ch: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() {
      return { buffer: null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
    }
    resume() { this.resumeCalls++; this.state = 'running'; return Promise.resolve(); }
    suspend() { this.suspendCalls++; this.state = 'suspended'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = StubCtx;
}

const gesture = () => act(() => {
  document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
});

const liveCtx = (): StubState =>
  (getBgmTarget() as unknown as { ctx: StubState }).ctx;

beforeEach(() => {
  localStorage.clear();
  __resetBgmForTest();
  __resetAudioForTest();
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
  // jsdom에 없는 API — 타이틀 화면의 튜토리얼 앵커가 쓴다.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

describe('App이 오디오 배선을 마운트한다', () => {
  it('첫 제스처로 오디오가 해제된다 (useAudioUnlock)', () => {
    installStub();
    render(<App />);
    expect(isAudioRunning(), '렌더만으로는 컨텍스트를 만들지 않는다(자동재생 정책)').toBe(false);

    gesture();

    // 이게 실패하면 App이 해제 훅을 안 부르는 것이고, 그 상태의 게임은 완전 무음이다.
    expect(isAudioRunning(), 'App이 useAudioUnlock을 마운트했다').toBe(true);
  });

  it('탭을 떠나면 컨텍스트를 재운다 (useAudioLifecycle)', () => {
    installStub();
    render(<App />);
    gesture();
    const ctx = liveCtx();
    expect(ctx.state).toBe('running');

    act(() => { window.dispatchEvent(new Event('pagehide')); });

    // 이게 실패하면 App이 수명 훅을 안 부르는 것이고, 배경음이 백그라운드에서 계속 흐른다.
    expect(ctx.suspendCalls, 'App이 useAudioLifecycle을 마운트했다').toBeGreaterThan(0);
    expect(ctx.state).toBe('suspended');
  });

  it('돌아오면 다시 깨운다', () => {
    installStub();
    render(<App />);
    gesture();
    const ctx = liveCtx();
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(ctx.state).toBe('suspended');

    act(() => { window.dispatchEvent(new Event('pageshow')); });
    expect(ctx.state).toBe('running');
  });

  it('배경음 설정이 켜져 있으면 첫 제스처에 재생이 시작된다', () => {
    installStub();
    setBgmEnabled(true);
    render(<App />);
    gesture();

    // 설정 구독(syncBgmWithSettings)까지 App을 통해 살아 있어야 한다.
    expect(isBgmPlaying(), 'App이 배경음 구독을 마운트했다').toBe(true);
  });

  it('언마운트하면 리스너가 남지 않는다', () => {
    installStub();
    const { unmount } = render(<App />);
    gesture();
    const ctx = liveCtx();
    unmount();

    const before = ctx.suspendCalls;
    window.dispatchEvent(new Event('pagehide'));
    expect(ctx.suspendCalls, '언마운트 후에는 반응하지 않는다').toBe(before);
  });
});
