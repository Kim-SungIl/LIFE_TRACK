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
// 4) **지속음(BGM)과 일회음(SFX)의 수명이 다르다** — SFX는 "지금 못 내면 버린다"가 정답이지만,
//    BGM은 한 번 못 켜면 세션 내내 조용하다. 그래서 버스를 둘로 나누고 접근자도 둘로 나눈다.
//    getAudioTarget()은 음소거면 null(= 노드를 만들 이유가 없다)이지만, getBgmTarget()은
//    음소거를 판단하지 않는다 — 껐다 켜는 주체는 bgm.ts의 설정 구독이다.
//
// 실제 소리의 생김새(주파수·엔벨로프)는 sfx.ts / bgm.ts가 갖는다. 이 파일은 "언제 소리를 낼 수 있는가"만 책임진다.

const STORAGE_KEY = 'lifetrack_audio';
const DEFAULT_VOLUME = 0.7;

export interface AudioSettings {
  muted: boolean;
  /** 0.0 ~ 1.0 마스터 볼륨 */
  volume: number;
  /**
   * 배경음 켜짐. **기본값 false다.** 3자 검수 공통 권고 —
   * 지속음은 원하지 않는 사용자에게 훨씬 거슬리고, 이 게임은 모바일 중심이라
   * 꺼진 상태에서 시작해 원하는 사람만 켜는 쪽이 안전하다.
   */
  bgmEnabled: boolean;
  /** 0.0 ~ 1.0 배경음 볼륨 (마스터에 곱해진다) */
  bgmVolume: number;
}

const DEFAULT_BGM_VOLUME = 0.5;

const DEFAULTS: AudioSettings = {
  muted: false, volume: DEFAULT_VOLUME,
  bgmEnabled: false, bgmVolume: DEFAULT_BGM_VOLUME,
};

function clamp01(v: number, fallback = DEFAULT_VOLUME): number {
  if (!Number.isFinite(v)) return fallback;
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
      bgmEnabled: typeof parsed.bgmEnabled === 'boolean' ? parsed.bgmEnabled : DEFAULTS.bgmEnabled,
      bgmVolume: clamp01(
        typeof parsed.bgmVolume === 'number' ? parsed.bgmVolume : DEFAULTS.bgmVolume,
        DEFAULT_BGM_VOLUME,
      ),
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
// 그래프: [SFX 노드] → sfxGain ┐
//         [BGM 노드] → bgmGain ┴→ masterGain → destination
// 버스를 나눈 이유는 볼륨을 따로 주기 위해서다. 한 버스면 BGM을 줄이려면 SFX도 같이 줄어든다.
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let bgmGain: GainNode | null = null;
let settings: AudioSettings = { ...DEFAULTS };
let settingsLoaded = false;
const listeners = new Set<(s: AudioSettings) => void>();
// **"컨텍스트가 running이 됐다"는 별개의 사건이다.** resume()은 비동기라, 첫 제스처 직후에
// 동기로 물어보면 아직 suspended다. 일회음은 그 한 번을 버려도 되지만 지속음은 그때 못 켜면
// 아무도 다시 켜주지 않는다 — 실제로 "🎵를 눌러도 다음 클릭까지 조용한" 증상이 나왔다.
// 그래서 준비 완료를 알리는 채널을 따로 둔다. bgm.ts가 이걸 받아 재생을 시작한다.
const readyListeners = new Set<() => void>();

function notifyReady(): void {
  readyListeners.forEach(fn => { try { fn(); } catch { /* 구독자 오류가 오디오를 막지 않는다 */ } });
}

/** 컨텍스트가 실제로 running이 된 순간을 알린다. 지속음을 켤 수 있는 유일하게 확실한 시점이다. */
export function subscribeAudioReady(fn: () => void): () => void {
  readyListeners.add(fn);
  return () => { readyListeners.delete(fn); };
}

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
  if (bgmGain) {
    // BGM은 지속음이라 볼륨 변화가 더 잘 들린다 — SFX보다 완만하게 넘긴다.
    bgmGain.gain.cancelScheduledValues(ctx.currentTime);
    bgmGain.gain.setTargetAtTime(s.bgmVolume, ctx.currentTime, 0.08);
  }
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
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 1;     // SFX는 sfx.ts가 곡별 게인을 이미 조율해 뒀다
      sfxGain.connect(masterGain);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0;     // applyGain이 bgmVolume으로 올린다
      bgmGain.connect(masterGain);
    } catch {
      ctx = null; masterGain = null; sfxGain = null; bgmGain = null;
      return;
    }
  }
  // running이 아닌 모든 상태를 복구 대상으로 본다. suspended만 보면 iOS 사파리의
  // 'interrupted'(전화·Siri로 오디오 세션을 뺏긴 상태)가 그대로 남는다.
  // resume()은 Promise를 던질 수 있어 삼킨다.
  if (ctx.state !== 'running') {
    // **성공을 기다려서 알린다.** 여기서 동기로 진행하면 호출부는 아직 suspended인 컨텍스트를 본다.
    //
    // 이 알림은 getBgmTarget()의 자기치유 resume이 거는 알림과 **중복이다**(뮤테이션으로 확인:
    // 여기를 지워도 테스트가 통과한다 — BGM이 켜져 있으면 getBgmTarget 경로가 알려주기 때문).
    // 그래도 남기는 이유는 이쪽이 "해제 성공"의 의미상 주인이고, getBgmTarget이 나중에
    // 자기치유를 잃으면 여기가 유일한 통로가 되기 때문이다.
    void ctx.resume().then(() => { applyGain(); notifyReady(); }).catch(() => { });
  }
  // 이미 running인 경우는 알리지 않는다. unlockAudio는 제스처 리스너에서만 불리고 그 리스너는
  // running이 확인되면 떨어지므로, 그 구간은 onGesture가 직접 부르는 startBgm()이 덮는다.
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
  if (!ctx || !sfxGain) return null;
  if (ensureSettings().muted) return null;   // 음소거면 노드를 만들 이유가 없다(resume도 걸지 않는다)
  if (ctx.state !== 'running') {
    // 이번 소리는 포기한다 — suspended 상태에서 스케줄하면 사라지는 게 아니라
    // 큐에 쌓였다가 복귀 순간 한꺼번에 터진다(주 넘김 20번치가 동시에).
    //
    // 다만 **복귀 시도는 여기서 건다**. resume()을 부르는 곳이 unlockAudio뿐이면 그건 첫
    // 제스처에서 딱 한 번만 불리므로, 그 뒤 백그라운드 탭 suspend나 iOS interrupted로
    // 떨어졌을 때 running으로 돌아올 길이 영영 없다(= 세션 내내 무음).
    // 노드는 여전히 만들지 않으니 몰아 터짐은 재발하지 않고, 다음 상호작용부터 소리가 돌아온다.
    // 복귀에 성공하면 지속음도 다시 켤 수 있다 — 그 사건을 알린다.
    void ctx.resume().then(notifyReady).catch(() => { });
    return null;
  }
  return { ctx, destination: sfxGain };
}

/**
 * bgm.ts 전용 — 배경음을 붙일 목적지.
 *
 * **getAudioTarget()과 달리 음소거를 판단하지 않는다.** SFX용 계약("음소거면 null")을
 * 지속음에 쓰면 치명적이다: 음소거 상태에서 켜려 하면 null이라 안 켜지고, 나중에 음소거를
 * 풀어도 **아무도 다시 켜주지 않아** 세션 내내 조용하다. 지속음은 "지금 낼 수 있나"가 아니라
 * "누가 켜고 끄는가"의 문제이고, 그 주체는 bgm.ts의 설정 구독이다.
 *
 * 여기서 판단하는 건 컨텍스트 존재와 running 여부뿐이다.
 */
export function getBgmTarget(): { ctx: AudioContext; destination: GainNode } | null {
  if (!ctx || !bgmGain) return null;
  if (ctx.state !== 'running') {
    void ctx.resume().then(notifyReady).catch(() => { });
    return null;
  }
  return { ctx, destination: bgmGain };
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

export function setBgmEnabled(bgmEnabled: boolean): void {
  ensureSettings();
  settings = { ...settings, bgmEnabled };
  persist(settings);
  applyGain();
  // 실제로 재생을 켜고 끄는 건 이 알림을 받은 bgm.ts다 — 엔진은 음악을 모른다.
  listeners.forEach(fn => fn({ ...settings }));
}

export function setBgmVolume(bgmVolume: number): void {
  ensureSettings();
  settings = { ...settings, bgmVolume: clamp01(bgmVolume, DEFAULT_BGM_VOLUME) };
  persist(settings);
  applyGain();
  listeners.forEach(fn => fn({ ...settings }));
}

/**
 * 탭을 떠났을 때 호출한다. 컨텍스트를 suspend해서 배경에서 계속 울리지 않게 한다.
 * (지속음이 없던 시절에는 필요 없었다 — SFX는 상호작용에만 울리므로 탭을 떠나면 자연히 멈췄다.)
 * 복귀는 resumeAudio() 또는 다음 상호작용의 자기치유(getAudioTarget)가 담당한다.
 */
export function suspendAudio(): void {
  if (!ctx || ctx.state === 'suspended' || ctx.state === 'closed') return;
  void ctx.suspend().catch(() => { });
}

/** 탭으로 돌아왔을 때. 컨텍스트가 없으면 아무 일도 하지 않는다(첫 제스처 전). */
export function resumeAudio(): void {
  if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
  void ctx.resume().then(notifyReady).catch(() => { });
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
  sfxGain = null;
  bgmGain = null;
  settings = { ...DEFAULTS };
  settingsLoaded = false;
  listeners.clear();
  readyListeners.clear();
}
