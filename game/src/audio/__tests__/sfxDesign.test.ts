// @vitest-environment jsdom
// 음향 "설계 결정"을 잠그는 계약. 소리가 나느냐(audio.test.ts)가 아니라 **어떤 소리냐**를 본다.
//
// 여기 있는 두 결정은 나중에 무심코 되돌리기 가장 쉬운 것들이라 테스트로 못 박는다:
//   1) outcome은 극성이 없다 — 좋고 나쁨을 판정하지 않는다
//   2) 이벤트 등장음 등급화는 아래로만 한다 — 잦은 쪽을 낮추지, 중요한 쪽을 키우지 않는다
//
// 관측 방법: 기존 audio.test.ts의 스텁은 노드 "개수"만 세서 이 계약을 잡을 수 없다.
// 여기서는 게인 피크(envelope의 linearRampToValueAtTime 인자)와 주파수 글라이드
// (frequency.exponentialRampToValueAtTime 호출)까지 기록하는 스텁을 쓴다.
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { unlockAudio, __resetAudioForTest } from '../audioEngine';
import { playSfx, listSfxIds, type SfxId } from '../sfx';

interface Probe {
  gainPeaks: number[];
  freqGlides: number;
  starts: number[];
  stops: number[];
}

function installProbe(): Probe {
  // 한 테스트에서 두 소리를 비교하려면 매번 새 컨텍스트여야 한다 — 초기화를 빼면
  // 두 번째 measure()가 첫 번째 프로브에 기록해서 항상 0이 나온다(실제로 겪었다).
  __resetAudioForTest();
  const probe: Probe = { gainPeaks: [], freqGlides: 0, starts: [], stops: [] };
  // 게인 파라미터: envelope()가 linearRampToValueAtTime(peak, ...)로 정점을 찍는다.
  const gainParam = () => ({
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: (v: number) => { probe.gainPeaks.push(v); },
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(), value: 0,
  });
  // 주파수 파라미터: exponentialRampToValueAtTime이 곧 글라이드(= 방향성)다.
  const freqParam = () => ({
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: () => { probe.freqGlides++; },
    setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(), value: 0,
  });
  class StubCtx {
    state = 'running';
    currentTime = 0;
    sampleRate = 44100;
    destination = { kind: 'destination' };
    createGain() { return { gain: gainParam(), connect: vi.fn(), disconnect: vi.fn() }; }
    createOscillator() {
      return {
        type: 'sine', frequency: freqParam(), connect: vi.fn(), disconnect: vi.fn(),
        start: (t: number) => { probe.starts.push(t); },
        stop: (t: number) => { probe.stops.push(t); },
        onended: null,
      };
    }
    createBiquadFilter() { return { type: 'lowpass', frequency: freqParam(), connect: vi.fn(), disconnect: vi.fn() }; }
    createBuffer(_ch: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() {
      return {
        buffer: null, connect: vi.fn(), disconnect: vi.fn(),
        start: (t: number) => { probe.starts.push(t); },
        stop: (t: number) => { probe.stops.push(t); },
        onended: null,
      };
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = StubCtx;
  unlockAudio();
  // 마스터 게인도 하나 만들어지지만 setTargetAtTime을 쓰므로 gainPeaks에 섞이지 않는다.
  probe.gainPeaks.length = 0;
  return probe;
}

/** 한 효과음을 재생하고 관측치를 돌려준다. */
function measure(id: SfxId) {
  const probe = installProbe();
  playSfx(id);
  return {
    peak: Math.max(...probe.gainPeaks, 0),
    glides: probe.freqGlides,
    voices: probe.starts.length,
    span: Math.max(...probe.stops, 0) - Math.min(...probe.starts, 0),
    spread: Math.max(...probe.starts, 0) - Math.min(...probe.starts, 0),
  };
}

beforeEach(() => {
  localStorage.clear();
  __resetAudioForTest();
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
});

describe('outcome — 결과 착지음은 극성이 없다', () => {
  it('정의돼 있다', () => {
    expect(listSfxIds()).toContain('outcome');
  });

  // 이 게임에서 부호 기반 극성음이 왜 안 되는지는 sfx.ts의 outcome 주석에 데이터와 함께 있다
  // (요약: 정서가 부정인 선택지 76건 중 73건이 수치는 전부 양수 = 96%).
  // 극성은 "글라이드(음이 미끄러짐)"로 생기므로, 글라이드가 없다는 게 핵심 계약이다.
  it('주파수 글라이드가 없다 — 올라가지도 내려가지도 않는다', () => {
    expect(measure('outcome').glides).toBe(0);
  });

  // 양성 짝: 글라이드로 방향을 내는 소리가 실제로 존재해야 위 단언이 의미를 갖는다.
  // (모든 소리에 글라이드가 없다면 위 테스트는 아무것도 잠그지 못한다.)
  it('반면 statUp/statDown은 글라이드로 방향을 낸다', () => {
    expect(measure('statUp').glides).toBeGreaterThan(0);
    expect(measure('statDown').glides).toBeGreaterThan(0);
  });

  it('두 톤이 사실상 동시에 시작한다 — 아르페지오가 되면 방향이 생긴다', () => {
    const m = measure('outcome');
    expect(m.voices).toBeGreaterThan(1);
    expect(m.spread).toBeLessThanOrEqual(0.02);
  });

  // "page보다 한 뼘 또렷하되 이벤트 등장음보다는 훨씬 조용" — 크롬과 변화 사이의 자리.
  it('게인이 page보다 크고 eventAppear보다 작다', () => {
    const outcome = measure('outcome').peak;
    expect(outcome).toBeGreaterThan(measure('page').peak);
    expect(outcome).toBeLessThan(measure('eventAppear').peak);
  });
});

describe('이벤트 등장음 등급화는 아래로만 한다', () => {
  it('정의돼 있다', () => {
    expect(listSfxIds()).toContain('eventAppearMinor');
  });

  // 등장음은 한 판에 150~200회 울린다(학기 사건 주율 66%, selection.ts 8시드 실측).
  // 그 횟수에 gain 0.22는 청각 피로 1순위다. 잡사건을 낮추는 게 이 변경의 목적이므로
  // **더 조용하고 더 짧다**를 둘 다 잠근다.
  it('잡사건용 등장음이 기본 등장음보다 조용하다', () => {
    expect(measure('eventAppearMinor').peak).toBeLessThan(measure('eventAppear').peak);
  });

  it('잡사건용 등장음이 기본 등장음보다 짧다', () => {
    expect(measure('eventAppearMinor').span).toBeLessThan(measure('eventAppear').span);
  });

  // 상한 고정. 이어폰 없는 스피커 환경의 상한이라 여기서 더 키우면 안 된다.
  // (중요 이벤트를 "키우는" 방향의 등급화를 막는 가드 — 리뷰 3인이 독립적으로 지적한 항목)
  it('기본 등장음이 게임에서 가장 큰 단발음 자리를 유지한다', () => {
    const appear = measure('eventAppear').peak;
    for (const id of listSfxIds()) {
      if (id === 'eventAppear' || id === 'ending') continue; // ending은 엔딩 전용 1회
      expect(measure(id).peak).toBeLessThanOrEqual(appear);
    }
  });
});
