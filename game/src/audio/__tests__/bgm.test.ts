// @vitest-environment jsdom
// 배경음 계약 테스트.
//
// 버스 분리·탭 수명·getBgmTarget의 음소거 계약은 audio.test.ts(#393)가 이미 잠갔다.
// 이 파일은 **그 위에 올라간 것**만 본다:
//   · 켜짐 기본값과 영속
//   · 누가 켜고 끄는가 (설정 구독 + 오디오 준비 신호)
//   · resume이 비동기여도 켜지는가  ← 브라우저 실측으로 찾은 결함
//   · 루프가 이음새 없이 이어지는가
//   · 테마의 작곡 불변식 (게인·음계·빈 곳)
//   · **App이 실제로 이 배선을 마운트하는가** (#393의 뮤테이션 검수에서 뚫려 있던 자리)
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createElement } from 'react';
import { render, act } from '@testing-library/react';
import {
  getAudioSettings, loadAudioSettings, setMuted, setBgmEnabled,
  unlockAudio, getBgmTarget, __resetAudioForTest,
} from '../audioEngine';
import {
  startBgm, stopBgm, isBgmPlaying, syncBgmWithSettings, getMainTheme, __resetBgmForTest,
} from '../bgm';
import { useBgm } from '../useBgm';

// ===== 스텁 AudioContext =====
// **비동기 resume + suspended 초기 상태가 기본이다.** 동기 스텁은 현실보다 관대하다:
// 실제 브라우저에서 새 컨텍스트는 suspended로 태어나고 resume()은 프라미스다. 그 차이가
// "🎵를 눌러도 다음 클릭까지 조용한" 결함을 숨겼다(브라우저 실측으로 발견).
function installStub({ syncResume = false } = {}) {
  const oscs: { freq: number; started: number; stops: (number | undefined)[] }[] = [];
  const makeParam = () => ({
    setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(), value: 0,
  });
  class StubCtx {
    state = syncResume ? 'running' : 'suspended';
    currentTime = 0;
    sampleRate = 44100;
    resumeCalls = 0;
    suspendCalls = 0;
    destination = { __id: 'destination' };
    createGain() { return { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn() }; }
    createOscillator() {
      const rec = { freq: 0, started: -1, stops: [] as (number | undefined)[] };
      oscs.push(rec);
      return {
        type: 'sine' as OscillatorType,
        frequency: {
          setValueAtTime: (v: number) => { rec.freq = v; },
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(), disconnect: vi.fn(),
        start: (t: number) => { rec.started = t; },
        stop: (t?: number) => { rec.stops.push(t); },
        onended: null,
      };
    }
    createBiquadFilter() {
      return {
        type: 'lowpass' as BiquadFilterType,
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(), disconnect: vi.fn(),
      };
    }
    resume() {
      this.resumeCalls++;
      if (syncResume) { this.state = 'running'; return Promise.resolve(); }
      return Promise.resolve().then(() => { this.state = 'running'; });
    }
    suspend() { this.suspendCalls++; this.state = 'suspended'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = StubCtx;
  return { oscs };
}

/** 컨텍스트를 running까지 올린다 — 실제 경로(제스처 → 비동기 resume)를 그대로 지나간다. */
async function unlockAndSettle(): Promise<void> {
  await act(async () => { unlockAudio(); });
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

  it('켜짐 여부가 저장되고 다시 읽힌다', () => {
    setBgmEnabled(true);
    expect(loadAudioSettings().bgmEnabled).toBe(true);
  });

  it('손상된 저장값에서도 꺼짐으로 복구한다', () => {
    localStorage.setItem('lifetrack_audio', '{ 이건 JSON이 아님');
    expect(loadAudioSettings().bgmEnabled).toBe(false);
  });

  it('미지원 환경(AudioContext 없음)에서 켜도 죽지 않는다', () => {
    setBgmEnabled(true);
    expect(() => startBgm()).not.toThrow();
    expect(isBgmPlaying()).toBe(false);
    expect(() => stopBgm()).not.toThrow();
  });
});

// ===== 2. 누가 켜고 끄는가 =====
describe('전이 주체 — 제품이 켜고 끈다', () => {
  it('음소거 → 정지, 음소거 해제 → 제품이 다시 켠다', async () => {
    installStub();
    await unlockAndSettle();
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

  it('🎵만 끄면 멈추고 다시 켜면 재생된다 (음소거와 독립)', async () => {
    installStub();
    await unlockAndSettle();
    const unsub = syncBgmWithSettings();
    expect(isBgmPlaying(), '기본값은 꺼짐').toBe(false);

    act(() => { setBgmEnabled(true); });
    expect(isBgmPlaying()).toBe(true);
    act(() => { setBgmEnabled(false); });
    expect(isBgmPlaying()).toBe(false);
    unsub();
  });

  it('구독을 해제하면 더 이상 반응하지 않는다', async () => {
    installStub();
    await unlockAndSettle();
    syncBgmWithSettings()();
    act(() => { setBgmEnabled(true); });
    expect(isBgmPlaying()).toBe(false);
  });
});

// ===== 3. resume이 비동기라는 현실 =====
describe('resume이 비동기여도 켜진다', () => {
  it('첫 제스처 시점엔 suspended지만, 준비되면 제품이 켠다', async () => {
    installStub();
    setBgmEnabled(true);
    const unsub = syncBgmWithSettings();

    unlockAudio();
    expect(isBgmPlaying(), '이 시점엔 아직 못 켠다(suspended)').toBe(false);

    await act(async () => { await Promise.resolve(); });
    expect(isBgmPlaying(), '준비 신호가 켜준다').toBe(true);
    unsub();
  });

  it('잠긴 동안 🎵를 켜도, 준비되면 켜진다', async () => {
    installStub();
    const unsub = syncBgmWithSettings();
    unlockAudio();
    setBgmEnabled(true);
    expect(isBgmPlaying()).toBe(false);

    await act(async () => { await Promise.resolve(); });
    expect(isBgmPlaying(), '준비 신호가 켜준다').toBe(true);
    unsub();
  });

  // 이 경로는 getBgmTarget의 자기치유 알림만이 담당한다. 세션 도중 컨텍스트가 suspended로
  // 떨어지면(iOS 통화·Siri, 브라우저의 백그라운드 스로틀링) 루프 타이머가 다음 예약을 하러
  // 왔다가 잠긴 걸 발견한다. 그때 복구를 걸고 알리지 않으면, 사용자가 뭔가 누를 때까지
  // 배경음이 돌아오지 않는다.
  it('도중에 잠겨도 루프 타이머가 스스로 복구한다', async () => {
    installStub();
    // **가짜 타이머를 재생 시작 전에 켠다.** 뒤에 켜면 이미 만들어진 실제 타이머를 추적하지
    // 못해 advanceTimersByTime이 아무 일도 하지 않고, 단언이 공허하게 통과한다.
    vi.useFakeTimers();
    setBgmEnabled(true);
    const unsub = syncBgmWithSettings();
    await unlockAndSettle();
    expect(isBgmPlaying(), '먼저 재생 중이어야 한다').toBe(true);

    // 오디오 세션을 빼앗긴 상태를 만든다(iOS 통화·Siri, 백그라운드 스로틀링).
    // 상태만 바꾸고 복구는 **제품이** 하게 둔다.
    const ctx = (getBgmTarget() as unknown as { ctx: { state: string } }).ctx;
    ctx.state = 'suspended';

    // 다음 루프 예약 시점까지 흘린다 → scheduleLoop가 잠긴 컨텍스트를 만난다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(isBgmPlaying(), '복구 신호로 다시 켜진다').toBe(true);
    unsub();
  });

  it('준비 신호 구독도 해제된다 (누수 방지)', async () => {
    installStub();
    setBgmEnabled(true);
    syncBgmWithSettings()();
    unlockAudio();
    await act(async () => { await Promise.resolve(); });
    expect(isBgmPlaying()).toBe(false);
  });
});

// ===== 4. 루프 스케줄 =====
describe('루프 스케줄', () => {
  it('시작하면 한 루프분 노트를 예약한다', async () => {
    const { oscs } = installStub();
    await unlockAndSettle();
    setBgmEnabled(true);
    startBgm();
    expect(oscs.length).toBe(getMainTheme().notes.length);
    expect(oscs.every(o => o.started >= 0), '모두 절대 시각으로 예약된다').toBe(true);
  });

  it('루프가 끝나기 전에 다음 루프를 예약한다 (이음새가 끊기지 않는다)', async () => {
    const { oscs } = installStub();
    // 가짜 타이머는 startBgm **이전에** 켜야 한다 — 뒤에 켜면 이미 만들어진 실제 타이머를
    // 추적하지 못해 getTimerCount가 0이 되고, 단언이 엉뚱한 이유로 실패한다.
    vi.useFakeTimers();
    await unlockAndSettle();
    setBgmEnabled(true);
    startBgm();
    const first = oscs.length;
    const theme = getMainTheme();
    const loopSec = (60 / theme.bpm) * theme.loopBeats;

    // 루프 길이보다 **짧은** 시간만 흘려도 다음 루프가 이미 예약돼 있어야 한다.
    vi.advanceTimersByTime((loopSec - 0.5) * 1000);
    expect(oscs.length, '다음 루프가 미리 예약됐다').toBeGreaterThan(first);
  });

  it('정지하면 예약된 노트를 즉시 끊는다', async () => {
    const { oscs } = installStub();
    await unlockAndSettle();
    setBgmEnabled(true);
    startBgm();
    // 예약 시점엔 "미래 시각에 끝나도록" 걸려 있을 뿐이다 — 즉시 정지로 착각하면 안 된다.
    expect(oscs.every(o => o.stops.length === 1 && typeof o.stops[0] === 'number')).toBe(true);

    stopBgm();
    // 정지는 **인자 없는 stop()** = 지금 당장. 예약된 종료 시각을 기다리면 탭을 떠난 뒤에도
    // 15초짜리 루프의 잔향이 남는다.
    expect(oscs.every(o => o.stops.includes(undefined)), '즉시 끊는다').toBe(true);
  });

  it('정지하면 예약 타이머를 남기지 않는다', async () => {
    const { oscs } = installStub();
    vi.useFakeTimers();
    await unlockAndSettle();
    setBgmEnabled(true);
    startBgm();
    expect(vi.getTimerCount(), '재생 중에는 다음 루프 타이머가 있다').toBeGreaterThan(0);

    stopBgm();
    // playing 플래그로 막는 것만으로는 부족하다 — 타이머 자체가 남으면 누수다.
    expect(vi.getTimerCount(), '타이머를 실제로 해제한다').toBe(0);
    const after = oscs.length;
    vi.advanceTimersByTime(60_000);
    expect(oscs.length).toBe(after);
  });

  it('두 번 시작해도 겹쳐 울리지 않는다', async () => {
    const { oscs } = installStub();
    await unlockAndSettle();
    setBgmEnabled(true);
    startBgm();
    const first = oscs.length;
    startBgm();
    expect(oscs.length).toBe(first);
  });

  it('배경음이 꺼져 있으면 직접 startBgm을 불러도 시작하지 않는다', async () => {
    // 구독(apply)이 이미 조건을 보지만, startBgm 자신도 봐야 한다 — 지금은 구독만이
    // 호출자지만, 나중에 다른 자리에서 부르면 그 자리가 조건을 다시 쓰게 된다.
    installStub();
    await unlockAndSettle();
    expect(getAudioSettings().bgmEnabled).toBe(false);
    startBgm();
    expect(isBgmPlaying()).toBe(false);
  });

  it('음소거 상태면 켜져 있어도 시작하지 않는다', async () => {
    installStub();
    await unlockAndSettle();
    setBgmEnabled(true);
    setMuted(true);
    stopBgm();
    startBgm();
    // 마스터 게인이 0이라 들리지는 않지만, 오실레이터가 계속 돌고 상태가 어긋난다.
    expect(isBgmPlaying()).toBe(false);
  });
});

// ===== 5. App 배선 =====
// #393의 useAudioLifecycle은 훅 단위로는 잘 잠겼지만 **App이 그걸 마운트하는지**는
// 뚫려 있었다(호출을 지워도 전체 통과 — 뮤테이션으로 확인). 훅이 완벽해도 안 불리면
// 제품에는 그 기능이 없다. 같은 실수를 배경음에서 반복하지 않도록 여기서 잠근다.
describe('App 배선', () => {
  const appSrc = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

  it('App이 오디오 훅 세 개를 모두 부른다', () => {
    for (const hook of ['useAudioUnlock()', 'useAudioLifecycle()', 'useBgm()']) {
      expect(appSrc, `App.tsx가 ${hook}를 부른다`).toContain(hook);
    }
  });

  it('useBgm이 마운트되면 배경음이 켜지고, 언마운트되면 구독이 끊긴다', async () => {
    installStub();
    setBgmEnabled(true);
    const { unmount } = render(createElement(function Probe() { useBgm(); return null; }));
    await unlockAndSettle();
    expect(isBgmPlaying(), '훅이 살아 있으면 준비 신호로 켜진다').toBe(true);

    unmount();
    stopBgm();
    act(() => { setBgmEnabled(false); setBgmEnabled(true); });
    expect(isBgmPlaying(), '언마운트 후에는 설정 변화에 반응하지 않는다').toBe(false);
  });
});

// ===== 6. 작곡 불변식 =====
describe('테마 작곡 불변식', () => {
  const theme = getMainTheme();

  it('모든 노트가 루프 안에서 끝난다', () => {
    // 루프를 넘는 노트는 다음 루프의 같은 음과 겹쳐 점점 두꺼워진다.
    const over = theme.notes.filter(n => n.beat + n.beats > theme.loopBeats);
    expect(over.map(n => `${n.beat}+${n.beats}`)).toEqual([]);
  });

  it('모든 음이 A 마이너 펜타토닉이다 (효과음과 같은 음계)', () => {
    // 효과음이 한 판에 수백 번 배경음 위에 겹치므로 같은 음계여야 불협이 안 난다.
    const PENTA = [0, 3, 5, 7, 10];          // A C D E G (A 기준 반음 간격)
    const isPenta = (f: number) => {
      const semis = Math.round(12 * Math.log2(f / 440));
      return PENTA.includes(((semis % 12) + 12) % 12);
    };
    expect(theme.notes.filter(n => !isPenta(n.freq)).map(n => n.freq)).toEqual([]);
  });

  it('가장 큰 노트가 가장 조용한 효과음(tap)보다 작다', () => {
    // 배경음은 반주다. 이 부등호가 뒤집히면 전경으로 튀어나와 이벤트 텍스트와 경쟁한다.
    // 버스에 볼륨 배수가 없으므로(유니티 게인 계약) 노트 게인이 그대로 실효 게인이다.
    // tap 게인은 sfx.ts에서 직접 읽는다 — 숫자를 박아두면 sfx가 바뀔 때 조용히 어긋난다.
    const sfxSrc = readFileSync(resolve(process.cwd(), 'src/audio/sfx.ts'), 'utf8');
    const tapGain = Number(/tap:\s*\{[\s\S]*?gain:\s*([\d.]+)/.exec(sfxSrc)?.[1]);
    expect(tapGain, 'sfx.ts에서 tap 게인을 읽었다').toBeGreaterThan(0);
    expect(Math.max(...theme.notes.map(n => n.gain))).toBeLessThan(tapGain);
  });

  it('선율이 빈 곳을 남긴다 (촘촘하면 오래 머무는 화면에서 지친다)', () => {
    const sounding = theme.notes.reduce((s, n) => s + n.beats, 0);
    const voices = 3;   // 저역 · 패드 · 선율
    expect(sounding / voices / theme.loopBeats).toBeLessThan(1);
  });
});
