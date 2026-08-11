// 오디오 엔진 — Web Audio 컨텍스트 수명 + 마스터 볼륨/음소거 SSOT.
//
// 이 게임은 v8.2까지 완전 무음이었다. 사운드를 넣되 다음 제약을 전부 만족해야 한다:
//
// 1) **자동재생 정책** — 브라우저는 사용자 제스처 전에 AudioContext를 재생 상태로 두지 않는다.
//    그래서 컨텍스트를 모듈 로드 시점이 아니라 **첫 제스처에서 지연 생성**한다(unlockAudio).
//    제스처 전 play() 호출은 조용히 버린다(예외를 던지면 클릭 핸들러가 통째로 죽는다).
// 2) **미지원/테스트 환경** — jsdom에는 AudioContext가 없다. 여기서 throw하면 컴포넌트
//    테스트가 전부 깨지므로, 컨텍스트가 없으면 모든 API가 no-op으로 동작해야 한다.
//    "소리가 안 나는 것"은 허용되지만 "게임이 멈추는 것"은 허용되지 않는다.
// 3) **설정 영속** — 음량/음소거는 세이브가 아니라 기기 설정이다. startGame이 지우면 안 되므로
//    lifetrack_tutorial_ever_seen·lifetrack_rest_ack과 같은 영속 키 계열로 둔다.
//
// 실제 소리의 생김새(주파수·엔벨로프)는 sfx.ts가 갖는다. 이 파일은 "언제 소리를 낼 수 있는가"만 책임진다.

const STORAGE_KEY = 'lifetrack_audio';
const DEFAULT_VOLUME = 0.7;

export interface AudioSettings {
  muted: boolean;
  /** 0.0 ~ 1.0 마스터 볼륨 */
  volume: number;
}

const DEFAULTS: AudioSettings = { muted: false, volume: DEFAULT_VOLUME };

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, v));
}

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULTS.muted,
      volume: clamp01(typeof parsed.volume === 'number' ? parsed.volume : DEFAULTS.volume),
    };
  } catch {
    // 손상된 값/스토리지 차단(사파리 프라이빗 등) — 기본값으로 계속 간다.
    return { ...DEFAULTS };
  }
}

function persist(s: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* 스토리지 불가 환경 — 이번 세션 한정으로만 적용 */ }
}

type Ctor = typeof AudioContext;
function getAudioContextCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let settings: AudioSettings = { ...DEFAULTS };
let settingsLoaded = false;
const listeners = new Set<(s: AudioSettings) => void>();

function ensureSettings(): AudioSettings {
  if (!settingsLoaded) {
    settings = loadAudioSettings();
    settingsLoaded = true;
  }
  return settings;
}

/** 음소거·볼륨을 마스터 게인에 반영. 컨텍스트가 없으면 아무것도 안 한다. */
function applyGain(): void {
  if (!masterGain || !ctx) return;
  const s = ensureSettings();
  const target = s.muted ? 0 : s.volume;
  // 즉시 대입(value=)은 진행 중인 소리에 클릭 노이즈를 만든다 — 짧은 램프로 넘긴다.
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.015);
}

/**
 * 첫 사용자 제스처에서 호출한다. 이 시점 전에는 컨텍스트를 만들지 않는다
 * (만들어봐야 suspended 상태이고, 브라우저에 따라 콘솔 경고를 남긴다).
 * 여러 번 불려도 안전하다.
 */
export function unlockAudio(): void {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return;              // 미지원/jsdom — 영구 no-op
  if (!ctx) {
    try {
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0;  // applyGain이 램프로 올린다(부팅 팝 방지)
      masterGain.connect(ctx.destination);
    } catch {
      ctx = null; masterGain = null;
      return;
    }
  }
  // running이 아닌 모든 상태를 복구 대상으로 본다. suspended만 보면 iOS 사파리의
  // 'interrupted'(전화·Siri로 오디오 세션을 뺏긴 상태)가 그대로 남는다.
  // resume()은 Promise를 던질 수 있어 삼킨다.
  if (ctx.state !== 'running') void ctx.resume().catch(() => { });
  applyGain();
}

/**
 * 지금 실제로 소리를 낼 수 있는 상태인가. 제스처 리스너를 뗄 시점 판단용이다 —
 * unlockAudio()를 불렀다는 사실만으로는 해제가 성립했다는 보장이 없다(resume은 비동기).
 */
export function isAudioRunning(): boolean {
  return ctx?.state === 'running';
}

/** 재시도해도 소용없는 환경인가(AudioContext 자체가 없음). 리스너를 영구히 뗄 근거. */
export function isAudioUnsupported(): boolean {
  return getAudioContextCtor() === null;
}

/** sfx.ts 전용 — 소리를 붙일 목적지. 아직 잠겨 있으면 null이고, 호출부는 조용히 포기해야 한다. */
export function getAudioTarget(): { ctx: AudioContext; destination: GainNode } | null {
  if (!ctx || !masterGain) return null;
  if (ensureSettings().muted) return null;   // 음소거면 노드를 만들 이유가 없다(resume도 걸지 않는다)
  if (ctx.state !== 'running') {
    // 이번 소리는 포기한다 — suspended 상태에서 스케줄하면 사라지는 게 아니라
    // 큐에 쌓였다가 복귀 순간 한꺼번에 터진다(주 넘김 20번치가 동시에).
    //
    // 다만 **복귀 시도는 여기서 건다**. resume()을 부르는 곳이 unlockAudio뿐이면 그건 첫
    // 제스처에서 딱 한 번만 불리므로, 그 뒤 백그라운드 탭 suspend나 iOS interrupted로
    // 떨어졌을 때 running으로 돌아올 길이 영영 없다(= 세션 내내 무음).
    // 노드는 여전히 만들지 않으니 몰아 터짐은 재발하지 않고, 다음 상호작용부터 소리가 돌아온다.
    void ctx.resume().catch(() => { });
    return null;
  }
  return { ctx, destination: masterGain };
}

export function getAudioSettings(): AudioSettings {
  return { ...ensureSettings() };
}

export function setMuted(muted: boolean): void {
  ensureSettings();
  settings = { ...settings, muted };
  persist(settings);
  applyGain();
  listeners.forEach(fn => fn({ ...settings }));
}

export function setVolume(volume: number): void {
  ensureSettings();
  settings = { ...settings, volume: clamp01(volume) };
  persist(settings);
  applyGain();
  listeners.forEach(fn => fn({ ...settings }));
}

export function subscribeAudioSettings(fn: (s: AudioSettings) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 테스트 전용 — 모듈 싱글턴 상태를 초기화한다. */
export function __resetAudioForTest(): void {
  try { ctx?.close(); } catch { /* 이미 닫힘 */ }
  ctx = null;
  masterGain = null;
  settings = { ...DEFAULTS };
  settingsLoaded = false;
  listeners.clear();
}
