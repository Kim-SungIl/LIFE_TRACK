// @vitest-environment jsdom
// 배경음 계약 테스트.
//
// 지속음은 일회음과 실패 방식이 다르다. SFX는 "지금 못 내면 버린다"가 정답이지만 BGM은
// **한 번 못 켜면 세션 내내 조용하다.** 그래서 이 파일이 잠그는 것은 소리의 생김새보다
// **"누가 켜고 끄는가"** 쪽에 무게가 있다:
//   · getBgmTarget()이 음소거를 판단하지 않는다 (판단하면 음소거 해제 후 영구 무음)
//   · 음소거를 풀면 **제품이** 다시 켠다 (테스트가 재생 상태를 대신 만들지 않는다)
//   · 탭을 떠나면 멈추고 돌아오면 다시 켠다
//   · 버스가 실제로 갈라져 있다 (BGM 볼륨을 내려도 SFX가 안 줄어든다)
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createElement } from 'react';
import { render, act } from '@testing-library/react';
import {
  getAudioSettings, loadAudioSettings, setMuted, setBgmEnabled, setBgmVolume,
  unlockAudio, getAudioTarget, getBgmTarget, __resetAudioForTest,
} from '../audioEngine';
import {
  startBgm, stopBgm, isBgmPlaying, syncBgmWithSettings, getMainTheme, __resetBgmForTest,
} from '../bgm';
import { useAudioUnlock } from '../useAudioUnlock';
import { playSfx } from '../sfx';

// ===== 스텁 AudioContext =====
// 게인 노드마다 id를 붙이고 connect 대상을 기록해 **그래프 모양을 실제로 관측한다.**
// 이게 없으면 "버스를 나눴다"는 주장을 검증할 방법이 없다(두 접근자가 같은 노드를 돌려줘도 통과).
interface Edge { from: string; to: string }

/**
 * @param asyncResume 실제 브라우저처럼 resume()이 **비동기로** running이 되게 한다.
 *   동기 스텁은 현실보다 관대하다 — 첫 제스처 직후 동기로 물어보면 실제로는 아직 suspended다.
 *   그 차이가 "🎵를 눌러도 다음 클릭까지 조용한" 결함을 숨겼다(브라우저 실측으로 발견).
 */
function installStub(asyncResume = false) {
  const edges: Edge[] = [];
  // stop 인자를 기록한다. 예약 시점의 stop(미래시각)과 정지 시점의 stop()(인자 없음)을
  // 구분하지 못하면 "즉시 끊는다"는 단언이 공허해진다(뮤테이션 M19로 드러남).
  const oscs: { freq: number; started: number; stops: (number | undefined)[] }[] = [];
  const gainTargets = new Map<string, { value: number; ramps: number[] }>();
  let gainSeq = 0;

  const makeParam = (owner: string) => {
    const rec = { value: 0, ramps: [] as number[] };
    gainTargets.set(owner, rec);
    return {
      setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setTargetAtTime: (v: number) => { rec.value = v; rec.ramps.push(v); },
      cancelScheduledValues: vi.fn(),
      get value() { return rec.value; },
      set value(v: number) { rec.value = v; },
    };
  };

  class StubCtx {
    // 실제 브라우저에서 새 컨텍스트는 **suspended**로 태어난다. 여기서 'running'으로 시작하면
    // 자동재생 정책 경로를 아예 지나가지 않아, 잠긴 상태에서 생기는 결함이 전부 가려진다.
    state = asyncResume ? 'suspended' : 'running';
    currentTime = 0;
    sampleRate = 44100;
    resumeCalls = 0;
    suspendCalls = 0;
    destination = { __id: 'destination' };
    createGain() {
      const id = `gain${++gainSeq}`;
      return {
        __id: id,
        gain: makeParam(id),
        connect: (t: { __id?: string }) => { edges.push({ from: id, to: t.__id ?? '?' }); },
        disconnect: vi.fn(),
      };
    }
    createOscillator() {
      const rec = { freq: 0, started: -1, stops: [] as (number | undefined)[] };
      oscs.push(rec);
      const id = `osc${oscs.length}`;
      return {
        __id: id, type: 'sine' as OscillatorType,
        frequency: { setValueAtTime: (v: number) => { rec.freq = v; }, exponentialRampToValueAtTime: vi.fn() },
        connect: (t: { __id?: string }) => { edges.push({ from: id, to: t.__id ?? '?' }); },
        disconnect: vi.fn(),
        start: (t: number) => { rec.started = t; },
        stop: (t?: number) => { rec.stops.push(t); },
        onended: null,
      };
    }
    createBiquadFilter() {
      const id = 'filter';
      return {
        __id: id, type: 'lowpass' as BiquadFilterType,
        frequency: { setValueAtTime: vi.fn() },
        connect: (t: { __id?: string }) => { edges.push({ from: id, to: t.__id ?? '?' }); },
        disconnect: vi.fn(),
      };
    }
    createBuffer(_ch: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() {
      const id = 'bufsrc';
      return {
        __id: id, buffer: null,
        connect: (t: { __id?: string }) => { edges.push({ from: id, to: t.__id ?? '?' }); },
        disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null,
      };
    }
    resume() {
      this.resumeCalls++;
      if (!asyncResume) { this.state = 'running'; return Promise.resolve(); }
      // 마이크로태스크가 돌아야 running이 된다 = 호출 직후 동기 조회는 여전히 suspended.
      return Promise.resolve().then(() => { this.state = 'running'; });
    }
    suspend() { this.suspendCalls++; this.state = 'suspended'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = StubCtx;
  return { edges, oscs, gainTargets };
}

beforeEach(() => {
  localStorage.clear();
  __resetBgmForTest();
  __resetAudioForTest();
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
});

afterEach(() => { vi.useRealTimers(); });

// ===== 1. 설정 =====
describe('배경음 설정', () => {
  it('기본값은 꺼짐이다', () => {
    // 3자 검수 공통 권고. 지속음은 원치 않는 사용자에게 훨씬 거슬린다.
    expect(loadAudioSettings().bgmEnabled).toBe(false);
    expect(getAudioSettings().bgmEnabled).toBe(false);
  });

  it('기본 배경음 볼륨은 0.5이고 0~1로 클램프된다', () => {
    expect(loadAudioSettings().bgmVolume).toBeCloseTo(0.5);
    setBgmVolume(9);
    expect(getAudioSettings().bgmVolume).toBe(1);
    setBgmVolume(-1);
    expect(getAudioSettings().bgmVolume).toBe(0);
    setBgmVolume(Number.NaN);
    expect(getAudioSettings().bgmVolume).toBeCloseTo(0.5);   // 비정상값은 기본값으로
  });

  it('켜짐 여부가 저장되고 다시 읽힌다', () => {
    setBgmEnabled(true);
    expect(loadAudioSettings().bgmEnabled).toBe(true);
  });

  it('미지원 환경(AudioContext 없음)에서 켜도 죽지 않는다', () => {
    setBgmEnabled(true);
    expect(() => startBgm()).not.toThrow();
    expect(isBgmPlaying()).toBe(false);
    expect(() => stopBgm()).not.toThrow();
  });
});

// ===== 2. 버스 분리 =====
describe('버스 분리 (그래프 실측)', () => {
  it('sfx·bgm 버스가 각각 마스터로 들어간다', () => {
    const { edges } = installStub();
    unlockAudio();
    const toDest = edges.filter(e => e.to === 'destination');
    expect(toDest, '마스터 하나만 destination에 붙는다').toHaveLength(1);
    const master = toDest[0].from;
    const toMaster = edges.filter(e => e.to === master).map(e => e.from);
    expect(toMaster, 'sfx·bgm 두 버스가 마스터로 들어간다').toHaveLength(2);
    expect(new Set(toMaster).size, '두 버스는 서로 다른 노드다').toBe(2);
  });

  it('SFX와 BGM이 서로 다른 목적지를 받는다', () => {
    installStub();
    unlockAudio();
    const sfxDest = getAudioTarget()!.destination as unknown as { __id: string };
    const bgmDest = getBgmTarget()!.destination as unknown as { __id: string };
    expect(sfxDest.__id).not.toBe(bgmDest.__id);
  });

  it('배경음 볼륨을 내려도 SFX 버스 게인은 그대로다', () => {
    const { edges, gainTargets } = installStub();
    unlockAudio();
    const master = edges.find(e => e.to === 'destination')!.from;
    const bgmId = (getBgmTarget()!.destination as unknown as { __id: string }).__id;
    const sfxId = (getAudioTarget()!.destination as unknown as { __id: string }).__id;

    setBgmVolume(0.1);
    expect(gainTargets.get(bgmId)!.value).toBeCloseTo(0.1);
    expect(gainTargets.get(sfxId)!.value, 'SFX 버스는 영향 없음').toBe(1);
    expect(gainTargets.get(master)!.value, '마스터도 영향 없음').toBeCloseTo(0.7);
  });

  it('BGM 노드는 bgm 버스로, SFX 노드는 sfx 버스로 흐른다', () => {
    const { edges } = installStub();
    unlockAudio();
    const bgmId = (getBgmTarget()!.destination as unknown as { __id: string }).__id;
    const sfxId = (getAudioTarget()!.destination as unknown as { __id: string }).__id;

    setBgmEnabled(true);
    startBgm();
    playSfx('tap');

    expect(edges.some(e => e.from === 'filter' && e.to === bgmId), 'BGM 필터 → bgm 버스').toBe(true);
    // SFX 노트 게인은 sfx 버스로. bgm 버스로 가는 SFX 노드가 있으면 분리가 깨진 것이다.
    const sfxEdges = edges.filter(e => e.to === sfxId);
    expect(sfxEdges.length, 'SFX가 sfx 버스로 들어갔다').toBeGreaterThan(0);
    expect(edges.some(e => e.from.startsWith('gain') && e.to === bgmId && e.from !== bgmId), 'SFX 게인이 bgm 버스로 새지 않는다').toBe(false);
  });
});

// ===== 3. 지속음 접근자 계약 =====
describe('getBgmTarget — 지속음 계약', () => {
  it('음소거여도 null이 아니다 (SFX와 정반대)', () => {
    installStub();
    unlockAudio();
    setMuted(true);
    // 이 차이가 핵심이다. 음소거를 이유로 null을 주면, 음소거 해제 후 아무도 다시 켜주지 않는다.
    expect(getAudioTarget(), 'SFX는 음소거면 포기한다').toBeNull();
    expect(getBgmTarget(), 'BGM은 음소거를 판단하지 않는다').not.toBeNull();
  });

  it('running이 아니면 null이고 복구를 시도한다', () => {
    installStub();
    unlockAudio();
    const ctx = getBgmTarget()!.ctx as unknown as { state: string; resumeCalls: number };
    ctx.state = 'suspended';
    const before = ctx.resumeCalls;
    expect(getBgmTarget()).toBeNull();
    expect(ctx.resumeCalls, 'resume을 걸어 복귀 길을 남긴다').toBeGreaterThan(before);
  });
});

// ===== 4. 전이 주체 — 제품이 다시 켜는가 =====
describe('설정 구독이 켜고 끈다 (전이 주체)', () => {
  it('음소거 → 정지, 음소거 해제 → 제품이 다시 켠다', () => {
    installStub();
    unlockAudio();
    setBgmEnabled(true);
    const unsub = syncBgmWithSettings();
    expect(isBgmPlaying(), '켜짐 설정이면 재생 중').toBe(true);

    // **테스트는 setMuted만 부른다.** 재생 상태를 손으로 만들지 않는다 —
    // 그러면 "누가 다시 켜는가"의 공백을 테스트가 메워버려 영구 무음 버그를 못 잡는다.
    act(() => { setMuted(true); });
    expect(isBgmPlaying(), '음소거면 멈춘다').toBe(false);

    act(() => { setMuted(false); });
    expect(isBgmPlaying(), '해제하면 제품이 다시 켠다').toBe(true);

    unsub();
  });

  it('배경음만 끄면 멈추고, 다시 켜면 재생된다 (음소거와 독립)', () => {
    installStub();
    unlockAudio();
    const unsub = syncBgmWithSettings();
    expect(isBgmPlaying(), '기본값은 꺼짐이라 재생 안 함').toBe(false);

    act(() => { setBgmEnabled(true); });
    expect(isBgmPlaying()).toBe(true);
    act(() => { setBgmEnabled(false); });
    expect(isBgmPlaying()).toBe(false);
    unsub();
  });

  it('구독을 해제하면 더 이상 반응하지 않는다 (리스너 누수 방지)', () => {
    installStub();
    unlockAudio();
    const unsub = syncBgmWithSettings();
    unsub();
    act(() => { setBgmEnabled(true); });
    expect(isBgmPlaying()).toBe(false);
  });
});

// ===== 4b. 오디오 준비 신호 (resume이 비동기라는 현실) =====
describe('resume이 비동기여도 배경음이 켜진다', () => {
  function Harness() { useAudioUnlock(); return null; }

  it('첫 제스처 시점엔 아직 suspended지만, 준비되면 제품이 켠다', async () => {
    installStub(true);                 // 실제 브라우저 동작
    setBgmEnabled(true);
    render(createElement(Harness));

    await act(async () => {
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    // resume 프라미스가 해소되고 준비 신호가 돌면 재생이 시작돼야 한다.
    expect(isBgmPlaying(), 'resume 완료 후 제품이 켠다').toBe(true);
  });

  it('배경음을 켠 그 순간 컨텍스트가 잠겨 있어도, 준비되면 켜진다', async () => {
    installStub(true);
    render(createElement(Harness));
    // 제스처로 컨텍스트를 만들되, 아직 running이 아닌 시점에 설정을 켠다.
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    setBgmEnabled(true);
    expect(isBgmPlaying(), '이 시점엔 아직 못 켠다(suspended)').toBe(false);

    await act(async () => { await Promise.resolve(); });
    expect(isBgmPlaying(), '준비 신호가 켜준다').toBe(true);
  });

  it('준비 신호 구독도 해제된다 (누수 방지)', async () => {
    installStub(true);
    setBgmEnabled(true);
    const unsub = syncBgmWithSettings();
    unsub();
    unlockAudio();
    await act(async () => { await Promise.resolve(); });
    expect(isBgmPlaying()).toBe(false);
  });
});

// ===== 5. 탭 수명 (배선) =====
describe('탭 이탈·복귀 배선 (useAudioUnlock)', () => {
  function Harness() { useAudioUnlock(); return null; }

  const setVisibility = (v: 'hidden' | 'visible') => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('탭을 떠나면 배경음이 멈추고 컨텍스트를 suspend한다', () => {
    installStub();
    setBgmEnabled(true);
    render(createElement(Harness));
    // 제스처로 해제 — 실제 경로를 그대로 지나간다
    act(() => { document.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(isBgmPlaying(), '제스처 후 재생 시작').toBe(true);
    const ctx = getBgmTarget()!.ctx as unknown as { suspendCalls: number; state: string };

    act(() => { setVisibility('hidden'); });
    expect(isBgmPlaying(), '탭을 떠나면 멈춘다').toBe(false);
    expect(ctx.suspendCalls, '컨텍스트도 suspend').toBeGreaterThan(0);
  });

  it('탭으로 돌아오면 다시 켜진다', () => {
    installStub();
    setBgmEnabled(true);
    render(createElement(Harness));
    act(() => { document.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    act(() => { setVisibility('hidden'); });
    expect(isBgmPlaying()).toBe(false);

    act(() => { setVisibility('visible'); });
    expect(isBgmPlaying(), '복귀하면 제품이 다시 켠다').toBe(true);
  });

  it('pagehide에서도 멈춘다 (iOS 앱 전환)', () => {
    installStub();
    setBgmEnabled(true);
    render(createElement(Harness));
    act(() => { document.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(isBgmPlaying()).toBe(true);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(isBgmPlaying(), 'visibilitychange를 건너뛰는 경우의 안전망').toBe(false);
  });

  it('음소거 상태면 배경음이 켜져 있어도 제스처로 시작되지 않는다', () => {
    // 음소거로 새로고침한 뒤 첫 클릭 경로. 구독은 stopBgm으로 막아주지만 제스처 핸들러는
    // startBgm()을 직접 부르므로, startBgm 자신이 muted를 봐야 한다(뮤테이션 M7).
    // 마스터 게인이 0이라 들리지는 않지만, 오실레이터가 계속 돌고 상태가 어긋난다.
    installStub();
    setBgmEnabled(true);
    setMuted(true);
    render(createElement(Harness));
    act(() => { document.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(isBgmPlaying()).toBe(false);
  });

  it('배경음이 꺼져 있으면 제스처로도 켜지지 않는다', () => {
    installStub();
    render(createElement(Harness));
    act(() => { document.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(isBgmPlaying()).toBe(false);
  });
});

// ===== 6. 루프 스케줄 =====
describe('루프 스케줄', () => {
  it('시작하면 한 루프분 노트를 예약한다', () => {
    const { oscs } = installStub();
    unlockAudio();
    setBgmEnabled(true);
    startBgm();
    expect(oscs.length, '테마의 모든 노트가 예약된다').toBe(getMainTheme().notes.length);
    expect(oscs.every(o => o.started >= 0), '모두 절대 시각으로 예약된다').toBe(true);
  });

  it('루프가 끝나기 전에 다음 루프를 예약한다 (이음새가 끊기지 않는다)', () => {
    vi.useFakeTimers();
    const { oscs } = installStub();
    unlockAudio();
    setBgmEnabled(true);
    startBgm();
    const first = oscs.length;
    const theme = getMainTheme();
    const loopSec = (60 / theme.bpm) * theme.loopBeats;

    // 루프 길이보다 **짧은** 시간만 흘려도 다음 루프가 이미 예약돼 있어야 한다.
    // (LOOKAHEAD만큼 앞서 예약하는 설계 — 정확히 루프 끝에 깨면 이음새에 공백이 생긴다)
    vi.advanceTimersByTime((loopSec - 0.5) * 1000);
    expect(oscs.length, '다음 루프가 미리 예약됐다').toBeGreaterThan(first);
  });

  it('정지하면 예약된 노트를 즉시 끊는다', () => {
    const { oscs } = installStub();
    unlockAudio();
    setBgmEnabled(true);
    startBgm();
    // 예약 시점엔 "미래 시각에 끝나도록" 걸려 있을 뿐이다 — 이걸 즉시 정지로 착각하면 안 된다.
    expect(oscs.every(o => o.stops.length === 1 && typeof o.stops[0] === 'number'),
      '예약 단계에서는 미래 시각 stop만 걸려 있다').toBe(true);

    stopBgm();
    // 정지는 **인자 없는 stop()** 이다 = 지금 당장. 탭을 떠날 때 15초짜리 루프의 잔향이
    // 계속 울리면 안 되므로, 예약된 종료 시각을 기다리는 것으로는 부족하다.
    expect(oscs.every(o => o.stops.includes(undefined)), '즉시 끊는다').toBe(true);
  });

  it('정지하면 예약 타이머를 남기지 않는다', () => {
    vi.useFakeTimers();
    const { oscs } = installStub();
    unlockAudio();
    setBgmEnabled(true);
    startBgm();
    expect(vi.getTimerCount(), '재생 중에는 다음 루프 타이머가 있다').toBeGreaterThan(0);

    stopBgm();
    // playing 플래그로 막는 것만으로는 부족하다 — 타이머 자체가 남으면 누수다.
    // (플래그만 보는 단언은 타이머를 남기는 변형을 못 잡는다: 뮤테이션 M20)
    expect(vi.getTimerCount(), '타이머를 실제로 해제한다').toBe(0);
    const after = oscs.length;
    vi.advanceTimersByTime(60_000);
    expect(oscs.length, '더 이상 예약하지 않는다').toBe(after);
  });

  it('두 번 시작해도 겹쳐 울리지 않는다', () => {
    const { oscs } = installStub();
    unlockAudio();
    setBgmEnabled(true);
    startBgm();
    const first = oscs.length;
    startBgm();
    expect(oscs.length, '이미 재생 중이면 무시').toBe(first);
  });
});

// ===== 7. 작곡 불변식 =====
describe('테마 작곡 불변식', () => {
  const theme = getMainTheme();

  it('모든 노트가 루프 안에서 끝난다', () => {
    // 루프를 넘는 노트는 다음 루프의 같은 음과 겹쳐 점점 두꺼워진다.
    const over = theme.notes.filter(n => n.beat + n.beats > theme.loopBeats);
    expect(over.map(n => `${n.beat}+${n.beats}`)).toEqual([]);
  });

  it('모든 음이 A 마이너 펜타토닉이다 (효과음과 같은 음계)', () => {
    // 효과음이 한 판에 수백 번 배경음 위에 겹치므로 같은 음계 안에 있어야 불협이 안 난다.
    const PENTA = [0, 3, 5, 7, 10];          // A C D E G (A 기준 반음 간격)
    const isPenta = (f: number) => {
      const semis = Math.round(12 * Math.log2(f / 440));
      return PENTA.includes(((semis % 12) + 12) % 12);
    };
    const bad = theme.notes.filter(n => !isPenta(n.freq)).map(n => n.freq);
    expect(bad).toEqual([]);
  });

  it('실효 게인이 가장 조용한 효과음(tap)보다 낮다', () => {
    // 배경음은 반주다. 이 부등호가 뒤집히면 배경음이 전경으로 튀어나와 이벤트 텍스트와 경쟁한다.
    // tap 게인은 sfx.ts에서 직접 읽는다 — 여기에 숫자를 박아두면 sfx가 바뀔 때 조용히 어긋난다.
    const sfxSrc = readFileSync(resolve(process.cwd(), 'src/audio/sfx.ts'), 'utf8');
    const tapGain = Number(/tap:\s*\{[\s\S]*?gain:\s*([\d.]+)/.exec(sfxSrc)?.[1]);
    expect(tapGain, 'sfx.ts에서 tap 게인을 읽었다').toBeGreaterThan(0);

    const maxNote = Math.max(...theme.notes.map(n => n.gain));
    const defaultBgmVolume = loadAudioSettings().bgmVolume;
    expect(maxNote * defaultBgmVolume).toBeLessThan(tapGain);
  });

  it('선율이 빈 곳을 남긴다 (촘촘하면 오래 머무는 화면에서 지친다)', () => {
    const sounding = theme.notes.reduce((s, n) => s + n.beats, 0);
    // 성부가 여럿이라 합이 루프를 넘을 수 있다 — 성부 수로 나눈 평균 밀도로 본다.
    const voices = 3;   // 저역 · 패드 · 선율
    expect(sounding / voices / theme.loopBeats).toBeLessThan(1);
  });
});
