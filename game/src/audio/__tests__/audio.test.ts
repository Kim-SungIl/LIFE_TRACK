// @vitest-environment jsdom
// 오디오 계약 테스트.
//
// 가장 중요한 계약은 "소리가 난다"가 아니라 **"소리가 안 나는 환경에서도 게임이 죽지 않는다"**이다.
// playSfx는 클릭 핸들러 안에서 직접 불리므로, 여기서 예외가 새면 그 상호작용 자체가 통째로 죽는다.
// jsdom에는 AudioContext가 아예 없어서 이 파일은 그 "미지원 환경" 경로를 그대로 검증한다.
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  loadAudioSettings, getAudioSettings, setMuted, setVolume,
  subscribeAudioSettings, unlockAudio, getAudioTarget, __resetAudioForTest,
} from '../audioEngine';
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
      resume() { return Promise.resolve(); }
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

  // 탭을 백그라운드로 돌리면 브라우저가 컨텍스트를 suspended로 내린다. 그 상태에서 스케줄하면
  // 소리가 사라지는 게 아니라 **큐에 쌓였다가 복귀 순간 한꺼번에 터진다**(주 넘김 20번치가 동시에).
  // 그래서 running이 아닐 때는 노드를 만들지 않는 게 계약이다.
  it('suspended 상태에서는 노드를 만들지 않는다 (복귀 시 몰아 터지는 것 방지)', () => {
    const { started } = installStub();
    unlockAudio();
    const ctx = (getAudioTarget() as unknown as { ctx: { state: string } }).ctx;
    ctx.state = 'suspended';

    expect(getAudioTarget()).toBeNull();
    playSfx('confirm');
    playSfx('eventAppear');
    expect(started).toHaveLength(0);

    // running으로 돌아오면 다시 난다 — 영구 무음이 되면 그것도 버그다(양성 짝).
    ctx.state = 'running';
    playSfx('confirm');
    expect(started.length).toBeGreaterThan(0);
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
