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
  /**
   * 배경음 켜짐. **기본값 false다.** 3자 검수 공통 권고 — 지속음은 원하지 않는 사용자에게
   * 훨씬 거슬리고, 이 게임은 모바일 중심이라 꺼진 상태로 시작해 원하는 사람만 켜는 쪽이 안전하다.
   *
   * 음소거와 별개 축이다. "효과음만 켜기"가 흔한 요구여서 하나로 합칠 수 없다.
   * 볼륨 설정은 두지 않았다 — 두 버스는 유니티 게인이 계약이고(버스 삽입으로 음량이 변하면
   * sfx.ts의 게인 비율이 흔들린다), 배경음 음량은 테마의 노트 게인 자체로 조율한다.
   */
  bgmEnabled: boolean;
  /** 0.0 ~ 1.0 마스터 볼륨 */
  volume: number;
}

const DEFAULTS: AudioSettings = { muted: false, volume: DEFAULT_VOLUME, bgmEnabled: false };

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
      bgmEnabled: typeof parsed.bgmEnabled === 'boolean' ? parsed.bgmEnabled : DEFAULTS.bgmEnabled,
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

// 버스 구조 — destination ← masterGain ← { sfxGain, bgmGain }.
//
// 왜 나누는가: 음소거·마스터 볼륨은 masterGain 하나로 충분하지만, **효과음과 BGM은 성격이 다르다.**
// 효과음은 한 번 울리고 끝나는 단발이고 BGM은 계속 흐르는 지속음이라, 나중에 한쪽만 줄이거나
// (대화 중 BGM 덕킹) 한쪽만 끄는 요구가 반드시 생긴다. 소리가 붙은 뒤에 버스를 쪼개려면 이미
// 배선된 호출부를 전부 건드려야 하므로, BGM이 들어오기 전인 지금 나눠 둔다.
//
// 두 버스 모두 유니티 게인(1.0)으로 시작한다 — **효과음의 실제 음량은 이 변경으로 달라지지 않는다.**
// sfx.ts의 게인 비율(tap 0.05 ↔ eventAppear 0.22)이 설계의 핵심이라, 여기서 배수를 걸면 그 원칙이 깨진다.
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let bgmGain: GainNode | null = null;
let settings: AudioSettings = { ...DEFAULTS };
let settingsLoaded = false;
const listeners = new Set<(s: AudioSettings) => void>();
// **"컨텍스트가 running이 됐다"는 설정 변화와 다른 사건이다.** resume()은 비동기라, 첫 제스처
// 직후 동기로 물어보면 아직 suspended다. 일회음은 그 한 번을 버려도 되지만 지속음은 그때 못 켜면
// 아무도 다시 켜주지 않는다 — 실제로 "🎵를 눌러도 다음 클릭까지 조용한" 증상이 나왔다(브라우저 실측).
// bgm.ts가 이 신호를 받아 재생을 시작한다.
const readyListeners = new Set<() => void>();

function notifyReady(): void {
  readyListeners.forEach(fn => { try { fn(); } catch { /* 구독자 오류가 오디오를 막지 않는다 */ } });
}

/** 컨텍스트가 실제로 running이 된 순간. 지속음을 켤 수 있는 유일하게 확실한 시점이다. */
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
      sfxGain.gain.value = 1;
      sfxGain.connect(masterGain);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 1;
      bgmGain.connect(masterGain);
    } catch {
      ctx = null; masterGain = null; sfxGain = null; bgmGain = null;
      return;
    }
  }
  // running이 아닌 모든 상태를 복구 대상으로 본다. suspended만 보면 iOS 사파리의
  // 'interrupted'(전화·Siri로 오디오 세션을 뺏긴 상태)가 그대로 남는다.
  // resume()은 Promise를 던질 수 있어 삼킨다.
  // **성공을 기다려서 알린다.** 여기서 동기로 넘어가면 호출부는 아직 suspended인 컨텍스트를 본다.
  // 지속음은 그 한 번을 놓치면 다시 켜줄 사람이 없다.
  if (ctx.state !== 'running') {
    void ctx.resume().then(() => { applyGain(); notifyReady(); }).catch(() => { });
  }
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

/**
 * **단발 효과음 전용**(sfx.ts) — 소리를 붙일 목적지. 아직 잠겨 있으면 null이고, 호출부는 조용히 포기해야 한다.
 *
 * 이 계약은 "이번 한 방을 포기해도 되는 소리"에만 맞는다. 음소거면 null을 주는데, 지속음이 이걸 쓰면
 * 음소거를 **해제해도 아무도 다시 켜주지 않아** 그 세션 내내 조용해진다. 지속음은 getBgmTarget을 쓸 것.
 */
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
    // **이 알림은 중복이다**(뮤테이션으로 확인: 지워도 테스트가 통과한다). 배경음은 자기 루프
    // 타이머가 잠긴 걸 발견해 스스로 복구하므로 이쪽에 의존하지 않는다. 그래도 남기는 이유는
    // 사용자가 뭔가 누르는 순간이 루프 타이머보다 이를 수 있어 복귀가 조금 더 빨라지기 때문이다.
    void ctx.resume().then(notifyReady).catch(() => { });
    return null;
  }
  return { ctx, destination: sfxGain };
}

/**
 * **지속음 전용**(BGM) — 목적지는 bgmGain이다.
 *
 * getAudioTarget과 딱 한 군데가 다르다: **음소거를 이유로 null을 주지 않는다.** 음소거는 이미
 * masterGain이 0으로 처리하므로 들리지 않는 건 같지만, 스케줄러는 목적지를 계속 쥐고 있어
 * 음소거를 해제하는 순간 흐르던 자리에서 다시 들린다. 여기서 null을 주면 해제 시점에 스케줄러를
 * 되살릴 주체가 없어 세션 내내 무음이 된다 — 단발 효과음 계약을 지속음에 그대로 쓰면 나는 사고다.
 *
 * running이 아닐 때 포기하는 것은 같다. suspended에서 스케줄하면 복귀 순간 몰아서 터진다.
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

export function setBgmEnabled(bgmEnabled: boolean): void {
  ensureSettings();
  settings = { ...settings, bgmEnabled };
  persist(settings);
  // 실제로 재생을 켜고 끄는 건 이 알림을 받은 bgm.ts다 — 엔진은 음악을 모른다.
  listeners.forEach(fn => fn({ ...settings }));
}

export function setVolume(volume: number): void {
  ensureSettings();
  settings = { ...settings, volume: clamp01(volume) };
  persist(settings);
  applyGain();
  listeners.forEach(fn => fn({ ...settings }));
}

/**
 * 탭이 백그라운드로 갔을 때 — 컨텍스트를 재운다.
 *
 * 단발 효과음만 있던 시절엔 없어도 티가 안 났다(짧고, 백그라운드에서 울릴 일 자체가 드물다).
 * 지속음이 들어오면 얘기가 달라진다 — 탭을 옮겨도 BGM이 계속 흐르고, 여러 탭을 열면 겹친다.
 * suspend는 그래프를 얼리는 것이라 잘라내는 소리(클릭 노이즈)가 나지 않는다.
 *
 * 컨텍스트를 close하지 않는 이유: close는 되돌릴 수 없어 복귀 시 재생성 + 첫 제스처 대기가
 * 다시 필요해진다. 탭을 돌아오는 건 제스처가 아니므로 그대로 영구 무음이 된다.
 */
export function suspendAudioForBackground(): void {
  if (!ctx || ctx.state !== 'running') return;
  void ctx.suspend().catch(() => { });
}

/**
 * 탭으로 돌아왔을 때 — 재개한다.
 *
 * getAudioTarget도 running이 아니면 resume을 걸지만, 그건 **다음 상호작용이 있어야** 걸린다.
 * 그러면 돌아온 뒤 첫 소리 한 번은 조용히 버려지고, BGM은 사용자가 뭔가 누를 때까지 침묵한다.
 * 복귀 자체를 신호로 삼아 먼저 깨워 둔다.
 */
export function resumeAudioFromBackground(): void {
  if (!ctx || ctx.state === 'running') return;
  // 복귀가 성립한 뒤 알린다 — 백그라운드에서 멈춘 지속음을 여기서 다시 켠다.
  void ctx.resume().then(() => { applyGain(); notifyReady(); }).catch(() => { });
  applyGain();
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
