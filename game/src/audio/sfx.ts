// 절차적 효과음 — 음원 파일 없이 Web Audio로 합성한다. 배포 용량 0바이트.
//
// 음향 방향: 이 게임은 조용하고 서정적인 7년짜리 학교생활물이다. 레트로 칩튠(구형파·빠른 어택)은
// 톤이 정면으로 어긋나므로 **사인/삼각파 + 완만한 엔벨로프 + 저음량**만 쓴다.
// 음정은 A 마이너 펜타토닉에서 고른다 — 어떤 두 음을 겹쳐도 불협이 안 나서, 소리가 연달아
// 겹쳐 울릴 때(빠른 연타·결산 화면의 스탯 변화 나열) 안전하다.
//
// 강약 배분은 프로젝트 UI 원칙을 그대로 따른다(자세히는 memory: UI 절제는 크롬에만, 변화는 또렷이):
//   · 크롬(버튼·탭·페이지 넘김) = 거의 안 들릴 만큼 조용히
//   · 변화(이벤트 등장·스탯 변동·시험 결과·엔딩) = 또렷하게
// 그래서 tap의 게인은 0.05인데 eventAppear는 0.22다. 이 비율을 임의로 평탄화하지 말 것.
import { getAudioTarget } from './audioEngine';

// A 마이너 펜타토닉 (A4 기준) — 겹쳐도 불협이 없는 음 집합
const A4 = 440.00;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.00;
const E4 = 329.63;
const A3 = 220.00;

export type SfxId =
  | 'tap'          // 일반 버튼·활동 카드 탭 (가장 조용)
  | 'select'       // 이벤트 선택지 확정
  | 'confirm'      // 한 주 확정 — 진행의 앵커
  | 'page'         // 이벤트 페이지 넘김 (종이 질감)
  | 'eventAppear'  // 이벤트 등장 — 또렷이
  | 'eventAppearMinor' // 잡사건(school-life) 등장 — 같은 종, 절반 무게
  | 'outcome'      // 이벤트 결과 착지 — **극성 없음** (아래 주석 참조)
  | 'statUp'
  | 'statDown'
  | 'examResult'   // 시험 결과 공개
  | 'ending';      // 엔딩 진입

interface ToneSpec {
  freq: number;
  /** 시작 시점 오프셋(초) — 두 음을 연달아 두면 아르페지오가 된다 */
  at?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  /** 끝 주파수 — 주면 그 값까지 미끄러진다(글라이드) */
  toFreq?: number;
}

interface NoiseSpec {
  at?: number;
  dur: number;
  gain: number;
  /** 로우패스 컷오프(Hz) — 낮을수록 먹먹한 종이 소리 */
  cutoff: number;
}

interface SfxSpec {
  tones?: ToneSpec[];
  noises?: NoiseSpec[];
}

// 각 효과음의 생김새 SSOT. 값을 바꾸면 소리가 바뀌므로 튜닝은 여기서만 한다.
const SFX: Record<SfxId, SfxSpec> = {
  // 크롬 — 있는지도 모를 만큼 조용. 연타해도 피로하지 않아야 한다.
  tap: { tones: [{ freq: E5, dur: 0.055, gain: 0.05, type: 'sine' }] },

  // 선택지 확정 — tap보다 한 뼘 또렷하고, 아래에서 위로 짧게 열린다.
  select: {
    tones: [
      { freq: C5, dur: 0.07, gain: 0.09, type: 'sine' },
      { freq: G5, at: 0.045, dur: 0.10, gain: 0.07, type: 'sine' },
    ],
  },

  // 한 주 확정 — 이 게임에서 가장 자주 반복되는 동작(336주). 따뜻하되 절대 튀지 않게.
  confirm: {
    tones: [
      { freq: A4, dur: 0.10, gain: 0.10, type: 'triangle' },
      { freq: E5, at: 0.06, dur: 0.16, gain: 0.08, type: 'sine' },
    ],
  },

  // 페이지 넘김 — 음정 없는 종이 질감. 로우패스 노이즈 한 번.
  page: { noises: [{ dur: 0.09, gain: 0.05, cutoff: 1400 }] },

  // 이벤트 등장 — "또렷이" 쪽. 종소리처럼 배음을 얹고 여운을 길게.
  eventAppear: {
    tones: [
      { freq: A4, dur: 0.90, gain: 0.22, type: 'sine' },
      { freq: E5, at: 0.02, dur: 0.75, gain: 0.10, type: 'sine' },
      { freq: A5, at: 0.04, dur: 0.55, gain: 0.05, type: 'sine' },
    ],
  },

  // 잡사건(school-life 풀) 등장 — 같은 종이되 무게를 절반으로.
  //
  // **등급화는 아래로만 한다.** 이벤트 등장은 한 판에 150~200회 울린다(학기 사건 주율 66%,
  // selection.ts의 8시드 실측). 그 횟수에 gain 0.22는 이 게임에서 청각 피로 1순위다.
  // 중요 이벤트를 더 키우는 방향은 금지 — 0.22는 이어폰 없는 스피커 환경의 상한이고,
  // 소리 크기가 "이번 이벤트는 크다"를 **선택 전에** 알려주는 힌트가 된다.
  eventAppearMinor: {
    tones: [
      { freq: A4, dur: 0.45, gain: 0.11, type: 'sine' },
      { freq: E5, at: 0.02, dur: 0.35, gain: 0.05, type: 'sine' },
    ],
  },

  // 이벤트 결과 착지 — **의도적으로 극성이 없다. 좋고 나쁨을 판정하지 않는다.**
  //
  // 처음엔 outcomeGood/outcomeBad 2종을 만들려 했다. 이벤트 데이터를 세어보고 기각했다:
  // toneTag가 붙은 선택지 213건 중 정서가 부정 계열(melancholy·regret·burden)인 76건에서
  // **73건(96%)이 수치는 전부 양수다.** 예: reachMid.ts의 유나 조명 부스 컷은
  // effects{talent+1,mental+1} + 유나 ♥4인데 toneTag는 melancholy이고 회상 문구는
  // "무대 대신 조명 부스 고른 유나."다. 부호로 극성을 내면 이 게임이 가장 공들인 애틋한
  // 순간 대부분에 밝은 상승음이 붙는다. 예외가 아니라 규칙이다.
  //
  // 배지는 초록/빨강으로 칠해도 되는데 소리는 안 되는 이유는 **주장의 크기가 달라서**다.
  // "📚 학업 +2"를 초록으로 칠하는 건 그 숫자의 부호를 말할 뿐이고, 소리 하나는 그 순간
  // 전체의 의미를 말한다. 이 게임은 결과를 판정해주는 게임이 아니라 나중에 되짚는 게임이다.
  //
  // 그래서 완전5도(A4+E4)를 고정으로 겹친다 — 상승도 하강도 아니라 방향이 없다.
  // 여기에 글라이드(toFreq)를 넣거나 한쪽을 올리면 그 순간 극성음이 되므로 넣지 말 것.
  outcome: {
    tones: [
      { freq: A4, dur: 0.30, gain: 0.08, type: 'sine' },
      { freq: E4, at: 0.01, dur: 0.34, gain: 0.05, type: 'sine' },
    ],
  },

  // 스탯 변화 — 결산 화면에서 여러 개가 연달아 울릴 수 있어 짧고 가볍게, 방향만 분명히.
  statUp: { tones: [{ freq: E5, toFreq: G5, dur: 0.13, gain: 0.11, type: 'sine' }] },
  statDown: { tones: [{ freq: D5, toFreq: A4, dur: 0.16, gain: 0.10, type: 'sine' }] },

  // 시험 결과 — 결과를 마주하는 순간. 낮게 깔리고 위가 열린다.
  examResult: {
    tones: [
      { freq: E4, dur: 0.55, gain: 0.16, type: 'triangle' },
      { freq: C5, at: 0.10, dur: 0.50, gain: 0.10, type: 'sine' },
      { freq: G5, at: 0.20, dur: 0.45, gain: 0.06, type: 'sine' },
    ],
  },

  // 엔딩 — 7년의 끝. 가장 길고 낮게, 여운으로 끝난다.
  ending: {
    tones: [
      { freq: A3, dur: 2.2, gain: 0.20, type: 'sine' },
      { freq: E4, at: 0.25, dur: 2.0, gain: 0.13, type: 'sine' },
      { freq: C5, at: 0.50, dur: 1.8, gain: 0.09, type: 'sine' },
      { freq: E5, at: 0.80, dur: 1.5, gain: 0.05, type: 'sine' },
    ],
  },
};

/** 클릭 노이즈 방지용 공통 엔벨로프 — 짧은 어택 후 지수 감쇠. */
function envelope(ctx: AudioContext, gain: GainNode, start: number, dur: number, peak: number): void {
  const attack = Math.min(0.012, dur * 0.25);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  // exponentialRamp는 0에 도달할 수 없다(스펙상 0 금지) — 가청 이하 값으로 떨군다.
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
}

function playTone(ctx: AudioContext, dest: GainNode, spec: ToneSpec, now: number): void {
  const start = now + (spec.at ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = spec.type ?? 'sine';
  osc.frequency.setValueAtTime(spec.freq, start);
  if (spec.toFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(spec.toFreq, start + spec.dur);
  }
  envelope(ctx, gain, start, spec.dur, spec.gain);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + spec.dur + 0.02);
  // 노드 누수 방지 — 336주 × 여러 효과음이면 무시 못 할 양이 쌓인다.
  osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch { /* 이미 해제됨 */ } };
}

function playNoise(ctx: AudioContext, dest: GainNode, spec: NoiseSpec, now: number): void {
  const start = now + (spec.at ?? 0);
  const frames = Math.max(1, Math.floor(ctx.sampleRate * spec.dur));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(spec.cutoff, start);
  const gain = ctx.createGain();
  envelope(ctx, gain, start, spec.dur, spec.gain);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(start);
  src.stop(start + spec.dur + 0.02);
  src.onended = () => {
    try { src.disconnect(); filter.disconnect(); gain.disconnect(); } catch { /* 이미 해제됨 */ }
  };
}

/**
 * 효과음 재생. **어떤 상황에서도 throw하지 않는다** — 오디오가 잠겨 있거나(첫 제스처 전),
 * 미지원 브라우저거나, 음소거면 조용히 아무 일도 일어나지 않는다.
 * 클릭 핸들러 안에서 직접 부르는 함수라, 여기서 예외가 나면 그 상호작용 자체가 죽는다.
 */
export function playSfx(id: SfxId): void {
  // 참고: 아래 early return을 지워도 관측 동작은 같다 — 널 역참조가 try 안에서 나고 catch가 삼킨다
  // (뮤테이션 검수에서 확인, 유일한 MISS 항목). 즉 "안 죽는다"를 실제로 보장하는 건 catch이고
  // 이 가드는 의도를 드러내는 중복 방어다. catch를 좁히면 그때부터 이 줄이 방어의 주체가 되므로,
  // 둘 중 하나만 남길 생각이라면 **catch를 남길 것**.
  const target = getAudioTarget();
  if (!target) return;
  const spec = SFX[id];
  if (!spec) return;
  try {
    const now = target.ctx.currentTime;
    for (const t of spec.tones ?? []) playTone(target.ctx, target.destination, t, now);
    for (const n of spec.noises ?? []) playNoise(target.ctx, target.destination, n, now);
  } catch { /* 오디오는 부가 기능 — 실패해도 게임 진행을 막지 않는다 */ }
}

/** 테스트·검증용 — 정의된 효과음 목록 */
export function listSfxIds(): SfxId[] {
  return Object.keys(SFX) as SfxId[];
}
