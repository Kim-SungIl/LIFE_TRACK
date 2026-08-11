// @vitest-environment jsdom
// 오디오 계약 테스트.
//
// 가장 중요한 계약은 "소리가 난다"가 아니라 **"소리가 안 나는 환경에서도 게임이 죽지 않는다"**이다.
// playSfx는 클릭 핸들러 안에서 직접 불리므로, 여기서 예외가 새면 그 상호작용 자체가 통째로 죽는다.
// jsdom에는 AudioContext가 아예 없어서 이 파일은 그 "미지원 환경" 경로를 그대로 검증한다.
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import {
  loadAudioSettings, getAudioSettings, setMuted, setVolume,
  subscribeAudioSettings, unlockAudio, getAudioTarget, isAudioRunning, __resetAudioForTest,
} from '../audioEngine';
import { useAudioUnlock } from '../useAudioUnlock';
import { playSfx, listSfxIds, type SfxId } from '../sfx';

beforeEach(() => {
  localStorage.clear();
  __resetAudioForTest();
  // 스텁 AudioContext가 다음 테스트로 새면 "미지원 환경" 케이스가 거짓으로 통과한다.
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
});

describe('audioEngine — 미지원 환경(jsdom, AudioContext 없음)', () => {
  it('unlockAudio가 예외를 던지지 않고, 타깃은 null로 남는다', () => {
    expect(() => unlockAudio()).not.toThrow();
    expect(getAudioTarget()).toBeNull();
  });

  it('playSfx는 모든 효과음 id에 대해 조용히 no-op이다', () => {
    for (const id of listSfxIds()) {
      expect(() => playSfx(id)).not.toThrow();
    }
  });

  it('해제 전에 playSfx를 불러도 안전하다 (첫 제스처 이전 클릭)', () => {
    expect(() => playSfx('confirm')).not.toThrow();
  });

  it('정의되지 않은 id가 들어와도 죽지 않는다 (구세이브·오타 방어)', () => {
    expect(() => playSfx('nope' as SfxId)).not.toThrow();
  });
});

describe('audioEngine — 설정 영속', () => {
  it('기본값은 소리 켜짐, 볼륨 0.7', () => {
    const s = loadAudioSettings();
    expect(s.muted).toBe(false);
    expect(s.volume).toBeCloseTo(0.7);
  });

  it('음소거가 localStorage에 저장되고 다시 읽힌다', () => {
    setMuted(true);
    expect(getAudioSettings().muted).toBe(true);
    expect(loadAudioSettings().muted).toBe(true);
  });

  it('볼륨은 0~1로 클램프된다', () => {
    setVolume(5);
    expect(getAudioSettings().volume).toBe(1);
    setVolume(-3);
    expect(getAudioSettings().volume).toBe(0);
    setVolume(Number.NaN);
    expect(getAudioSettings().volume).toBeCloseTo(0.7); // 비정상값은 기본값으로
  });

  it('손상된 저장값이 있어도 기본값으로 복구한다', () => {
    localStorage.setItem('lifetrack_audio', '{ 이건 JSON이 아님');
    expect(() => loadAudioSettings()).not.toThrow();
    expect(loadAudioSettings().muted).toBe(false);
  });

  // 오디오 설정은 세이브가 아니라 기기 설정이다 — startGame이 지우는 키 계열에 들어가면 안 된다.
  // (lifetrack_tutorial_ever_seen · lifetrack_rest_ack과 같은 영속 계열)
  it('전용 키 lifetrack_audio에만 쓴다', () => {
    setMuted(true);
    setVolume(0.3);
    // jsdom Storage는 Object.keys로 열거되지 않는다(항상 []) — key(i)로 순회해야 실제로 검사된다.
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('lifetrack_')) keys.push(k);
    }
    expect(keys).toEqual(['lifetrack_audio']);
  });

  it('구독자가 변경 통지를 받는다', () => {
    const seen: boolean[] = [];
    const off = subscribeAudioSettings(s => seen.push(s.muted));
    setMuted(true);
    setMuted(false);
    off();
    setMuted(true);            // 해제 후엔 안 와야 한다
    expect(seen).toEqual([true, false]);
  });
});

describe('sfx — 음향 설계 계약', () => {
  it('선언된 모든 SfxId에 정의가 있다', () => {
    const ids = listSfxIds();
    expect(ids).toContain('tap');
    expect(ids).toContain('confirm');
    expect(ids).toContain('eventAppear');
    expect(ids).toContain('ending');
    expect(new Set(ids).size).toBe(ids.length); // 중복 없음
  });
});

// AudioContext가 있는 브라우저 경로 — 최소 스텁으로 "실제로 노드를 만들어 붙이는지"까지 본다.
// 이게 없으면 위 테스트는 전부 no-op 경로만 통과시켜, 소리 로직을 통째로 지워도 초록이 된다.
describe('sfx — 브라우저 경로 (AudioContext 스텁)', () => {
  function installStub() {
    const started: number[] = [];
    const connected: string[] = [];
    const makeParam = () => ({
      setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(), value: 0,
    });
    class StubCtx {
      state = 'running';
      currentTime = 0;
      sampleRate = 44100;
      // 복구 배선 관측용. resumeRestores=true가 실제 브라우저 동작(resume하면 running으로 돌아옴)이고,
      // false는 브라우저가 응답하지 않는 상황이다. **테스트가 state를 직접 되돌리지 않는 게 핵심** —
      // 그러면 "누가 running으로 되돌리는가"를 테스트가 대신해줘서 제품의 공백을 못 잡는다.
      resumeCalls = 0;
      resumeRestores = true;
      destination = { kind: 'destination' };
      createGain() { connected.push('gain'); return { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn() }; }
      createOscillator() {
        connected.push('osc');
        return {
          type: 'sine', frequency: makeParam(), connect: vi.fn(), disconnect: vi.fn(),
          start: (t: number) => started.push(t), stop: vi.fn(), onended: null,
        };
      }
      createBiquadFilter() {
        connected.push('filter');
        return { type: 'lowpass', frequency: makeParam(), connect: vi.fn(), disconnect: vi.fn() };
      }
      createBuffer(_ch: number, len: number) {
        return { getChannelData: () => new Float32Array(len) };
      }
      createBufferSource() {
        connected.push('bufferSource');
        return {
          buffer: null, connect: vi.fn(), disconnect: vi.fn(),
          start: (t: number) => started.push(t), stop: vi.fn(), onended: null,
        };
      }
      resume() {
        this.resumeCalls++;
        if (this.resumeRestores) this.state = 'running';
        return Promise.resolve();
      }
      close() { return Promise.resolve(); }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = StubCtx;
    return { started, connected };
  }

  it('해제 후 playSfx가 실제로 오실레이터를 만들고 시작시킨다', () => {
    const { started, connected } = installStub();
    unlockAudio();
    expect(getAudioTarget()).not.toBeNull();

    playSfx('confirm');
    expect(connected).toContain('osc');
    expect(started.length).toBeGreaterThan(0);
  });

  it('page는 음정이 아니라 노이즈 버퍼로 난다 (종이 질감)', () => {
    const { connected } = installStub();
    unlockAudio();
    playSfx('page');
    expect(connected).toContain('bufferSource');
    expect(connected).toContain('filter');
  });

  type LiveCtx = { state: string; resumeCalls: number; resumeRestores: boolean };
  const liveCtx = (): LiveCtx =>
    (getAudioTarget() as unknown as { ctx: LiveCtx }).ctx;

  // 탭을 백그라운드로 돌리면 브라우저가 컨텍스트를 suspended로 내린다. 그 상태에서 스케줄하면
  // 소리가 사라지는 게 아니라 **큐에 쌓였다가 복귀 순간 한꺼번에 터진다**(주 넘김 20번치가 동시에).
  // 그래서 running이 아닐 때는 노드를 만들지 않는 게 계약이다.
  it('suspended 상태에서는 노드를 만들지 않되, 복구를 건다', () => {
    const { started } = installStub();
    unlockAudio();
    const ctx = liveCtx();
    ctx.resumeRestores = false;   // 브라우저가 아직 응답하지 않는 상황
    ctx.state = 'suspended';

    expect(getAudioTarget()).toBeNull();
    playSfx('confirm');
    playSfx('eventAppear');
    expect(started).toHaveLength(0);
    // 노드를 안 만드는 것만으로는 부족하다 — 복구 시도가 없으면 그대로 영구 무음이다.
    expect(ctx.resumeCalls).toBeGreaterThan(0);
  });

  // 회귀 방지(codex 리뷰 [MED]): resume을 부르는 곳이 unlockAudio뿐이면 그건 첫 제스처에서만
  // 불리므로, 그 뒤 suspended로 떨어지면 되돌아올 길이 없어 세션 내내 무음이 된다.
  // **여기서 state를 테스트가 되돌리지 않는다** — 되돌려주면 제품의 공백을 그대로 통과시킨다.
  it('suspended로 떨어져도 스스로 회복해 다음 소리부터 다시 난다', () => {
    const { started } = installStub();
    unlockAudio();
    const ctx = liveCtx();
    ctx.state = 'suspended';      // resumeRestores는 기본 true = 실제 브라우저 동작

    expect(getAudioTarget()).toBeNull();   // 이번 한 번은 포기한다(몰아 터짐 방지)
    expect(started).toHaveLength(0);

    playSfx('confirm');                    // 앞선 호출이 건 복구가 반영된 뒤
    expect(started.length).toBeGreaterThan(0);
  });

  // iOS 사파리는 전화·Siri로 오디오 세션을 뺏기면 'suspended'가 아니라 'interrupted'가 된다.
  // suspended만 복구 대상으로 보면 이 상태가 그대로 남는다.
  it("iOS의 'interrupted' 상태도 복구 대상이다", () => {
    installStub();
    unlockAudio();
    const ctx = liveCtx();
    ctx.state = 'interrupted';

    unlockAudio();
    expect(ctx.state).toBe('running');
  });

  it('음소거 중에는 복구도 걸지 않는다 (꺼둔 소리를 되살리려 들면 안 된다)', () => {
    installStub();
    unlockAudio();
    const ctx = liveCtx();
    setMuted(true);
    ctx.resumeRestores = false;
    ctx.state = 'suspended';
    const before = ctx.resumeCalls;

    playSfx('confirm');
    expect(ctx.resumeCalls).toBe(before);
  });

  it('음소거 상태에서는 노드를 아예 만들지 않는다', () => {
    const { started } = installStub();
    unlockAudio();
    setMuted(true);
    playSfx('confirm');
    playSfx('eventAppear');
    expect(started).toHaveLength(0);
  });

  // 크롬은 조용히, 변화는 또렷이 — 이 비율이 뒤집히면 UI 원칙이 깨진다.
  // (memory: UI 절제는 크롬에만, 이벤트 발생·능력치 변화는 또렷이)
  it('크롬(tap)이 변화(eventAppear)보다 조용하다', () => {
    const { connected } = installStub();
    unlockAudio();
    // 게인 값 자체는 스텁으로 관측하기 번거로워, 소리의 층 수로 대신 확인한다:
    // tap은 단일 톤, eventAppear는 배음을 얹은 다층 구조여야 한다.
    connected.length = 0;
    playSfx('tap');
    const tapNodes = connected.filter(c => c === 'osc').length;
    connected.length = 0;
    playSfx('eventAppear');
    const eventNodes = connected.filter(c => c === 'osc').length;
    expect(tapNodes).toBe(1);
    expect(eventNodes).toBeGreaterThan(tapNodes);
  });
});

// 회귀 방지(codex 리뷰 [MED]): unlockAudio()를 "불렀다"와 해제가 "성립했다"는 다른 사건이다.
// resume은 비동기고 컨텍스트 생성은 실패할 수 있는데, 호출 직후 무조건 리스너를 떼면
// 그 한 번의 실패가 세션 전체의 영구 무음이 된다.
describe('useAudioUnlock — 해제 실패 시 다음 제스처가 재시도한다', () => {
  function installFlakyCtx(shouldFail: () => boolean) {
    class FlakyCtx {
      state = 'running';
      currentTime = 0;
      destination = { kind: 'destination' };
      constructor() {
        if (shouldFail()) throw new Error('컨텍스트 생성 실패');
      }
      createGain() {
        return {
          gain: { value: 0, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() },
          connect: vi.fn(), disconnect: vi.fn(),
        };
      }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = FlakyCtx;
  }

  it('첫 제스처에서 컨텍스트 생성이 실패해도 두 번째 제스처에서 살아난다', () => {
    let fail = true;
    installFlakyCtx(() => fail);
    render(createElement(function Probe() { useAudioUnlock(); return null; }));

    document.dispatchEvent(new Event('pointerdown'));
    expect(isAudioRunning()).toBe(false);   // 첫 시도 실패

    fail = false;
    document.dispatchEvent(new Event('pointerdown'));
    expect(isAudioRunning()).toBe(true);    // 리스너가 남아 있어야만 여기 도달한다
  });
});
