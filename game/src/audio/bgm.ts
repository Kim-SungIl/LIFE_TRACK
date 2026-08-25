// 배경음 — 음원 파일 없이 Web Audio로 합성한다. 배포 용량 0바이트.
//
// **"루프냐 절차적이냐"는 잘못된 축이다.** 절차적 생성(난수로 음을 고르는 방식)은 기억에 남는
// 테마에 도달하지 못한다. 대신 **작곡된 마디를 노트 리스트 상수로 적고** sfx.ts와 같은
// 오실레이터 합성으로 렌더한다. 그러면 파일 0바이트로 "작곡된 음악"이 나온다.
//
// 음향 방향은 sfx.ts와 같은 언어를 쓴다 — A 마이너 펜타토닉, 사인파, 완만한 엔벨로프.
// 효과음과 배경음이 같은 음계 안에 있으면 동시에 울려도 불협이 나지 않는다. 이게 펜타토닉을
// 고른 실용적 이유다(효과음은 한 판에 수백 번 배경음 위에 겹친다).
//
// **게인 규율**: 배경음은 반주다. 아래 노트 게인은 bgmVolume(기본 0.5)으로 한 번 더 줄어들고,
// 그렇게 나온 **실효 게인이 가장 조용한 효과음(tap 0.05)보다 낮아야 한다** — 최대 노트가
// 0.055이므로 실효 0.0275다. 이 부등호를 테스트가 잠근다. 여기 값을 올려 "잘 들리게" 만들려는
// 유혹이 생기면 그건 배경음이 아니라 전경음이 되고, 화면의 이벤트 텍스트와 경쟁한다.
//
// 켜고 끄는 주체가 이 파일이다 — 엔진은 음악을 모른다. 설정 구독으로 mute/bgmEnabled 변화를
// 받아 start/stop한다. 이게 없으면 음소거를 풀어도 아무도 다시 켜주지 않는다.
import {
  getBgmTarget, getAudioSettings, subscribeAudioSettings, subscribeAudioReady,
} from './audioEngine';

// ===== 음정 (A 마이너 펜타토닉: A C D E G) =====
const A2 = 110.00;
const E3 = 164.81;
const A3 = 220.00;
const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const G4 = 392.00;
const A4 = 440.00;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;

interface BgmNote {
  /** 루프 시작으로부터 몇 박째에 시작하는가 */
  beat: number;
  freq: number;
  /** 길이(박) */
  beats: number;
  gain: number;
  type?: OscillatorType;
}

interface BgmTrack {
  bpm: number;
  /** 루프 길이(박) */
  loopBeats: number;
  notes: BgmNote[];
}

/**
 * 메인 테마 — "저녁 무렵의 교실".
 *
 * 63 BPM · 16박(약 15.2초) 루프. 느리고 빈 곳이 많게 뒀다. 이 게임은 한 화면에서 오래
 * 머무는 편이라(루틴 고르기·이벤트 읽기) 음이 촘촘하면 금방 지친다.
 *
 * 구조는 두 마디 화성 하나뿐이다(Am → C 느낌). 전개를 넣지 않은 것도 의도다 —
 * 배경음이 서사를 주장하면 화면의 이벤트 텍스트와 경쟁한다.
 */
const MAIN_THEME: BgmTrack = {
  bpm: 63,
  loopBeats: 16,
  notes: [
    // 저역 — 두 화성의 뿌리. 낮은 음은 같은 게인에서 더 조용하게 들려 약간 높게 준다.
    { beat: 0, freq: A2, beats: 7.5, gain: 0.055 },
    { beat: 8, freq: E3, beats: 7.5, gain: 0.050 },
    // 중역 패드 — 화성을 채우되 거의 안 들릴 만큼
    { beat: 0, freq: A3, beats: 7.5, gain: 0.030 },
    { beat: 8, freq: C4, beats: 7.5, gain: 0.028 },
    // 선율 — 삼각파로 살짝 존재감만. 마지막 두 박은 비워 숨을 남긴다.
    { beat: 0.0, freq: A4, beats: 1.5, gain: 0.042, type: 'triangle' },
    { beat: 2.0, freq: C5, beats: 1.0, gain: 0.038, type: 'triangle' },
    { beat: 3.5, freq: E5, beats: 1.5, gain: 0.040, type: 'triangle' },
    { beat: 6.0, freq: D5, beats: 1.0, gain: 0.036, type: 'triangle' },
    { beat: 8.0, freq: C5, beats: 1.5, gain: 0.040, type: 'triangle' },
    { beat: 10.0, freq: A4, beats: 1.0, gain: 0.036, type: 'triangle' },
    { beat: 11.5, freq: G4, beats: 1.5, gain: 0.034, type: 'triangle' },
    { beat: 13.0, freq: E4, beats: 2.0, gain: 0.032, type: 'triangle' },
  ],
};

/**
 * 엔딩 회상 테마 — "돌아보면".
 *
 * 60 BPM · 32박(32초) 루프. 엔딩 회고 화면 전용이다.
 *
 * **정서 방향이 이 곡의 설계 조건이다.** 그 화면은 성취("돌아보면")와 후회("미처 닿지 못한 것")를
 * 같은 지면에 놓는다. 그래서 승리도 비극도 아니어야 한다 — 잘했든 못했든 같은 곡이 흐른다.
 * 마지막 두 음이 상승하지 않고 C5로 내려앉는 것이 그 판단이다(올라가며 끝내면 "승리"가 된다).
 *
 * 메인 테마와 달리 선율이 분명하다. 엔딩은 한 판의 끝이라 기억에 남아야 하는 자리이고,
 * 배경으로 물러나 있어야 하는 주간 루프와 역할이 다르다. 다만 화면 체류가 1~2분이라
 * 루프를 두세 바퀴 듣게 되므로, 짧은 C5–E5 동기를 변형해 돌려쓴다(반복 내성).
 *
 * 60 BPM이라 박과 초가 1:1이다 — beat 값을 초로 읽어도 된다.
 */
const ENDING_RECALL: BgmTrack = {
  bpm: 60,
  loopBeats: 32,
  notes: [
    { beat: 0, freq: A3, beats: 4, gain: 0.045, type: 'triangle' },
    { beat: 0, freq: C4, beats: 3.6, gain: 0.035 },
    { beat: 1, freq: C5, beats: 1.4, gain: 0.055 },
    { beat: 3, freq: E5, beats: 1.4, gain: 0.055 },

    { beat: 4, freq: E4, beats: 4, gain: 0.045, type: 'triangle' },
    { beat: 5, freq: D5, beats: 1.4, gain: 0.055 },
    { beat: 7, freq: C5, beats: 1.2, gain: 0.05 },

    { beat: 8, freq: G4, beats: 4, gain: 0.04, type: 'triangle' },
    { beat: 8, freq: D4, beats: 3.6, gain: 0.035 },
    { beat: 9, freq: E5, beats: 1.4, gain: 0.055 },
    { beat: 11, freq: G5, beats: 1.4, gain: 0.052 },

    { beat: 12, freq: D4, beats: 4, gain: 0.04, type: 'triangle' },
    { beat: 13, freq: E5, beats: 1.4, gain: 0.05 },
    { beat: 15, freq: D5, beats: 1.4, gain: 0.052 },

    { beat: 16, freq: A3, beats: 4, gain: 0.045, type: 'triangle' },
    { beat: 16, freq: C4, beats: 3.6, gain: 0.035 },
    { beat: 17, freq: C5, beats: 1.4, gain: 0.055 },
    { beat: 19, freq: E5, beats: 1.4, gain: 0.055 },

    { beat: 20, freq: E4, beats: 4, gain: 0.045, type: 'triangle' },
    { beat: 21, freq: D5, beats: 1.4, gain: 0.052 },
    { beat: 23, freq: C5, beats: 1.4, gain: 0.05 },

    { beat: 24, freq: C4, beats: 4, gain: 0.04, type: 'triangle' },
    { beat: 24, freq: G4, beats: 3.6, gain: 0.035 },
    { beat: 25, freq: D5, beats: 1.5, gain: 0.05 },
    { beat: 27, freq: E5, beats: 1.3, gain: 0.047 },

    // 마지막 마디 — 올라가지 않고 C5로 내려앉는다
    { beat: 28, freq: A3, beats: 4, gain: 0.045, type: 'triangle' },
    { beat: 29, freq: C5, beats: 1.4, gain: 0.05 },
    { beat: 31, freq: C5, beats: 0.9, gain: 0.04 },
  ],
};

/**
 * ===== 학교급 테마 3곡 — 초 / 중 / 고 =====
 *
 * **세 곡은 서로 다른 곡이 아니라 한 곡의 세 나이다.** 무관한 3곡이면 학년이 바뀔 때 다른
 * 게임에 들어온 것처럼 들린다. 그래서 짧은 동기 **A-C-E-D-C**를 셋이 공유하고, 음역·템포·
 * 화성으로만 온도를 바꾼다(초·중은 A4-C5-E5-D5-C5, 고는 한 옥타브 아래 A3-C4-E4-D4-C4).
 *
 * 온도 곡선은 새로 만든 게 아니라 backgrounds.ts의 학교급 tint를 그대로 따라간다 —
 * "초=따뜻(앰버) → 중=중립 → 고=차가움(블루): 유년의 온기가 입시의 냉기로 식는 정서 서사".
 * 화면이 이미 그렇게 말하고 있으므로 음악이 다른 소리를 하면 안 된다.
 *
 * **왜 32박인가**: 한 곡이 학교급당 약 112주 흐른다. 메인 테마(16박·15초)를 그대로 쓰면 같은
 * 15초를 수백 바퀴 듣게 되므로, 32박을 A마디(0~15) / B마디(16~31)로 나누고 B를 A의 변형으로
 * 뒀다. 엔딩 테마가 쓰는 것과 같은 기법이다.
 *
 * 밀도는 31 → 26 → 21로 줄어든다. 나이가 들수록 음이 비는 것도 온도 서사의 일부다.
 *
 * 메인 테마는 지우지 않는다 — 타이틀·기록실에는 학년이 없어서 걸 곡이 필요하다.
 * 그 화면들은 오래 머물지 않으므로 16박 루프의 반복 피로도 문제가 되지 않는다.
 */

/** 초등(Y1) — 가장 높고 촘촘하다. 들뜸은 템포(66)와 C5/E5의 밝기로 만든다. */
const ELEMENTARY_THEME: BgmTrack = {
  bpm: 66,
  loopBeats: 32,
  notes: [
    { beat: 0, freq: A3, beats: 4, gain: 0.042, type: 'triangle' },
    { beat: 0, freq: E4, beats: 3.5, gain: 0.028, type: 'sine' },
    { beat: 0, freq: A4, beats: 1.0, gain: 0.044, type: 'triangle' },
    { beat: 1.5, freq: C5, beats: 1.0, gain: 0.047, type: 'triangle' },
    { beat: 3, freq: E5, beats: 1.2, gain: 0.048, type: 'triangle' },

    { beat: 4, freq: C4, beats: 4, gain: 0.038, type: 'triangle' },
    { beat: 5, freq: D5, beats: 1.0, gain: 0.044, type: 'triangle' },
    { beat: 6.5, freq: C5, beats: 1.2, gain: 0.044, type: 'triangle' },

    { beat: 8, freq: E4, beats: 4, gain: 0.038, type: 'triangle' },
    { beat: 8, freq: G4, beats: 3.5, gain: 0.026, type: 'sine' },
    { beat: 9, freq: A4, beats: 1.0, gain: 0.04, type: 'triangle' },
    { beat: 10.5, freq: C5, beats: 1.0, gain: 0.044, type: 'triangle' },
    { beat: 12, freq: E5, beats: 1.1, gain: 0.046, type: 'triangle' },
    // A마디를 닫고 B로 넘어가는 바닥. 이게 없으면 12~16박에 화성이 통째로 빠져
    // 29초마다 음악이 얇아졌다 돌아온다(발주 1차본의 실제 결함이었다).
    { beat: 12, freq: D4, beats: 4, gain: 0.034, type: 'sine' },
    { beat: 14, freq: D5, beats: 1.0, gain: 0.04, type: 'triangle' },

    { beat: 16, freq: A3, beats: 4, gain: 0.04, type: 'triangle' },
    { beat: 16, freq: C4, beats: 3.5, gain: 0.028, type: 'sine' },
    { beat: 17, freq: C5, beats: 1.0, gain: 0.044, type: 'triangle' },
    { beat: 18.5, freq: E5, beats: 1.0, gain: 0.046, type: 'triangle' },
    { beat: 20, freq: D5, beats: 1.1, gain: 0.042, type: 'triangle' },

    { beat: 20, freq: G4, beats: 4, gain: 0.036, type: 'triangle' },
    { beat: 22, freq: C5, beats: 1.2, gain: 0.04, type: 'triangle' },
    { beat: 23.5, freq: A4, beats: 1.0, gain: 0.038, type: 'triangle' },

    { beat: 24, freq: C4, beats: 4, gain: 0.038, type: 'triangle' },
    { beat: 24, freq: E4, beats: 3.5, gain: 0.026, type: 'sine' },
    { beat: 25, freq: A4, beats: 1.0, gain: 0.038, type: 'triangle' },
    { beat: 26.5, freq: C5, beats: 1.0, gain: 0.042, type: 'triangle' },
    { beat: 28, freq: D5, beats: 1.0, gain: 0.04, type: 'triangle' },

    { beat: 28, freq: A3, beats: 4, gain: 0.04, type: 'triangle' },
    { beat: 30, freq: C5, beats: 1.0, gain: 0.04, type: 'triangle' },
    { beat: 31, freq: A4, beats: 1.0, gain: 0.034, type: 'triangle' },
  ],
};

/**
 * 중등(Y2~4) — 중립. 메인 테마가 있던 자리를 잇는다.
 * 저역 A2/E3를 넣어 루틴 화면의 체류감에 맞추고, 성공도 실패도 판정하지 않는다.
 */
const MIDDLE_THEME: BgmTrack = {
  bpm: 63,
  loopBeats: 32,
  notes: [
    { beat: 0, freq: A2, beats: 7.5, gain: 0.052, type: 'sine' },
    { beat: 0, freq: A3, beats: 7.5, gain: 0.028, type: 'sine' },
    { beat: 0, freq: A4, beats: 1.4, gain: 0.04, type: 'triangle' },
    { beat: 2, freq: C5, beats: 1.0, gain: 0.04, type: 'triangle' },
    { beat: 3.5, freq: E5, beats: 1.3, gain: 0.042, type: 'triangle' },
    { beat: 6, freq: D5, beats: 1.0, gain: 0.036, type: 'triangle' },

    { beat: 8, freq: E3, beats: 7.5, gain: 0.048, type: 'sine' },
    { beat: 8, freq: C4, beats: 7.5, gain: 0.027, type: 'sine' },
    { beat: 8, freq: C5, beats: 1.4, gain: 0.038, type: 'triangle' },
    { beat: 10, freq: A4, beats: 1.0, gain: 0.036, type: 'triangle' },
    { beat: 11.5, freq: G4, beats: 1.4, gain: 0.034, type: 'triangle' },
    { beat: 13.5, freq: E4, beats: 1.8, gain: 0.032, type: 'triangle' },

    { beat: 16, freq: A2, beats: 7.5, gain: 0.05, type: 'sine' },
    { beat: 16, freq: C4, beats: 7.5, gain: 0.027, type: 'sine' },
    { beat: 17, freq: A4, beats: 1.2, gain: 0.038, type: 'triangle' },
    { beat: 19, freq: C5, beats: 1.0, gain: 0.039, type: 'triangle' },
    { beat: 20.5, freq: E5, beats: 1.2, gain: 0.04, type: 'triangle' },
    { beat: 22.5, freq: D5, beats: 1.0, gain: 0.035, type: 'triangle' },

    // B마디는 동기를 G4/A4로 회수한다 — 자랐지만 아직 닫히지 않은 자리.
    { beat: 24, freq: G4, beats: 4, gain: 0.036, type: 'triangle' },
    { beat: 24, freq: D4, beats: 3.5, gain: 0.027, type: 'sine' },
    { beat: 25, freq: C5, beats: 1.0, gain: 0.036, type: 'triangle' },
    { beat: 26.5, freq: A4, beats: 1.0, gain: 0.034, type: 'triangle' },

    { beat: 28, freq: E3, beats: 4, gain: 0.046, type: 'sine' },
    { beat: 28, freq: A3, beats: 3.5, gain: 0.026, type: 'sine' },
    { beat: 29, freq: G4, beats: 1.2, gain: 0.032, type: 'triangle' },
    { beat: 31, freq: A4, beats: 0.9, gain: 0.032, type: 'triangle' },
  ],
};

/**
 * 고등(Y5~7) — 동기를 한 옥타브 낮춰(A3-C4-E4-D4-C4) 무게를 만든다.
 *
 * **차가운 것이지 비극이 아니다.** 이 게임은 입시 결과를 판정해주는 게임이 아니라 나중에
 * 되짚는 게임이라, 여기서 절망이나 비장함이 들어가면 화면이 하지 않는 말을 음악이 한다.
 * E/G 계열을 열어 둔 것이 그 판단이다.
 */
const HIGH_THEME: BgmTrack = {
  bpm: 58,
  loopBeats: 32,
  notes: [
    { beat: 0, freq: A2, beats: 7.5, gain: 0.054, type: 'sine' },
    { beat: 0, freq: E3, beats: 7.5, gain: 0.03, type: 'sine' },
    { beat: 1, freq: A3, beats: 1.8, gain: 0.034, type: 'triangle' },
    { beat: 4, freq: C4, beats: 1.6, gain: 0.034, type: 'triangle' },
    { beat: 6.5, freq: E4, beats: 1.0, gain: 0.032, type: 'triangle' },

    { beat: 8, freq: E3, beats: 7.5, gain: 0.048, type: 'sine' },
    { beat: 8, freq: G4, beats: 3.5, gain: 0.025, type: 'sine' },
    { beat: 9.5, freq: D4, beats: 1.6, gain: 0.032, type: 'triangle' },
    { beat: 12.5, freq: C4, beats: 1.8, gain: 0.032, type: 'triangle' },

    { beat: 16, freq: A2, beats: 7.5, gain: 0.052, type: 'sine' },
    // 패드가 E3다(C4가 아니라) — A마디 보이싱과 맞추고, 20박 선율 C4가 자기 패드에
    // 삼켜지지 않게 한다. 같은 음정이 겹치면 선율이 음정 변화로 읽히지 않는다.
    { beat: 16, freq: E3, beats: 7.5, gain: 0.026, type: 'sine' },
    { beat: 17, freq: A3, beats: 1.8, gain: 0.032, type: 'triangle' },
    { beat: 20, freq: C4, beats: 1.5, gain: 0.032, type: 'triangle' },
    { beat: 22.5, freq: D4, beats: 1.2, gain: 0.03, type: 'triangle' },

    { beat: 24, freq: G4, beats: 4, gain: 0.034, type: 'triangle' },
    { beat: 24, freq: D4, beats: 3.5, gain: 0.025, type: 'sine' },
    { beat: 25.5, freq: E4, beats: 1.4, gain: 0.03, type: 'triangle' },

    { beat: 28, freq: A2, beats: 4, gain: 0.052, type: 'sine' },
    { beat: 28, freq: E3, beats: 3.5, gain: 0.028, type: 'sine' },
    { beat: 29.5, freq: C4, beats: 1.4, gain: 0.03, type: 'triangle' },
    { beat: 31, freq: A3, beats: 1.0, gain: 0.03, type: 'triangle' },
  ],
};

export type BgmId = 'main' | 'endingRecall' | 'elementary' | 'middle' | 'high';

const TRACKS: Record<BgmId, BgmTrack> = {
  main: MAIN_THEME,
  endingRecall: ENDING_RECALL,
  elementary: ELEMENTARY_THEME,
  middle: MIDDLE_THEME,
  high: HIGH_THEME,
};

/** 지금 걸려 있는 곡. 화면이 바꾸고(setBgmTrack), 스케줄러는 이걸 읽는다. */
let currentId: BgmId = 'main';

/** 배경음 버스 앞단 로우패스 — 고역을 깎아 먹먹하고 따뜻하게. 텍스트를 읽는 화면이라 날카로우면 방해된다. */
const LOWPASS_HZ = 1800;

/** 루프를 미리 스케줄해 두는 여유(초). 타이머가 늦게 깨어도 이음새가 끊기지 않을 만큼. */
const LOOKAHEAD = 1.2;

let timer: ReturnType<typeof setTimeout> | null = null;
let filter: BiquadFilterNode | null = null;
let live = new Set<OscillatorNode>();
/** 다음 루프가 시작할 컨텍스트 시각(초). 절대 시각으로 누적해 타이머 지터가 쌓이지 않게 한다. */
let nextLoopAt = 0;
let playing = false;

function beatsToSec(track: BgmTrack, beats: number): number {
  return (60 / track.bpm) * beats;
}

/** sfx.ts의 envelope과 같은 형태 — 다만 지속음이라 어택·릴리스를 훨씬 길게 준다. */
function scheduleNote(
  ctx: AudioContext, dest: AudioNode, track: BgmTrack, note: BgmNote, loopStart: number,
): void {
  const start = loopStart + beatsToSec(track, note.beat);
  const dur = beatsToSec(track, note.beats);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = note.type ?? 'sine';
  osc.frequency.setValueAtTime(note.freq, start);
  // 어택을 길게(0.35초 또는 길이의 1/4) — 짧으면 배경음에서 타격감이 생겨 전경으로 튀어나온다.
  const attack = Math.min(0.35, dur * 0.25);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(note.gain, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.05);
  live.add(osc);
  osc.onended = () => {
    live.delete(osc);
    try { osc.disconnect(); gain.disconnect(); } catch { /* 이미 해제됨 */ }
  };
}

function scheduleLoop(): void {
  const target = getBgmTarget();
  // 컨텍스트가 죽었거나 잠겼다 — 조용히 접는다. 복귀는 startBgm()을 다시 부르는 쪽(설정 구독·
  // 탭 복귀)이 담당한다. 여기서 재시도 루프를 돌리면 잠긴 채로 타이머가 영원히 남는다.
  if (!target || !playing || !filter) { stopBgm(); return; }
  const { ctx } = target;
  const track = TRACKS[currentId];
  try {
    for (const note of track.notes) {
      scheduleNote(ctx, filter, track, note, nextLoopAt);
    }
  } catch { stopBgm(); return; }

  const loopDur = beatsToSec(track, track.loopBeats);
  nextLoopAt += loopDur;
  // 다음 루프를 시작 LOOKAHEAD초 전에 스케줄한다. 음수가 되면(탭 복귀 직후 등) 즉시.
  const waitMs = Math.max(0, (nextLoopAt - ctx.currentTime - LOOKAHEAD) * 1000);
  timer = setTimeout(scheduleLoop, waitMs);
}

/**
 * 배경음 시작. 설정이 꺼져 있거나 음소거면 아무 일도 하지 않는다.
 * 여러 번 불려도 안전하다(이미 재생 중이면 무시).
 */
export function startBgm(): void {
  if (playing) return;
  const s = getAudioSettings();
  if (!s.bgmEnabled || s.muted) return;
  const target = getBgmTarget();
  if (!target) return;      // 아직 첫 제스처 전 — 제스처 후 구독이 다시 부른다
  try {
    filter = target.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(LOWPASS_HZ, target.ctx.currentTime);
    filter.connect(target.destination);
  } catch { filter = null; return; }
  playing = true;
  // 살짝 뒤에서 시작 — 지금 시각에 걸면 스케줄이 이미 지나간 것으로 취급될 수 있다.
  nextLoopAt = target.ctx.currentTime + 0.15;
  scheduleLoop();
}

/** 배경음 정지. 예약된 음까지 즉시 끊는다(탭을 떠날 때 잔향이 남으면 안 된다). */
export function stopBgm(): void {
  playing = false;
  if (timer !== null) { clearTimeout(timer); timer = null; }
  for (const osc of live) {
    try { osc.stop(); } catch { /* 이미 끝났거나 시작 전 */ }
    try { osc.disconnect(); } catch { /* 이미 해제됨 */ }
  }
  live = new Set();
  if (filter) {
    try { filter.disconnect(); } catch { /* 이미 해제됨 */ }
    filter = null;
  }
}

export function isBgmPlaying(): boolean { return playing; }

/**
 * 배경음을 현실에 맞춘다. **이게 "누가 다시 켜주는가"의 답이다.**
 * App에서 한 번 호출하고 반환된 해제 함수를 정리에 쓴다.
 *
 * 두 가지 사건을 듣는다:
 *  1) **설정 변화** — 음소거·배경음 토글. 켜야 하면 켜고 아니면 끈다.
 *  2) **오디오 준비 완료** — resume()이 비동기라, 설정을 켠 그 순간엔 컨텍스트가 아직
 *     suspended일 수 있다. 그때 startBgm()은 조용히 실패한다. 이 신호가 없으면 사용자가
 *     🎵를 눌러도 **다음 클릭까지 아무 소리가 안 난다**(브라우저 실측으로 발견한 증상).
 *
 * 조건을 다시 계산하지 않고 startBgm/stopBgm에 위임한다(판단 로직이 두 곳에 생기면 어긋난다).
 */
export function syncBgmWithSettings(): () => void {
  const apply = (s: { muted: boolean; bgmEnabled: boolean }) => {
    if (s.bgmEnabled && !s.muted) startBgm();
    else stopBgm();
  };
  apply(getAudioSettings());
  const offSettings = subscribeAudioSettings(apply);
  // 준비 완료 시에도 같은 판단을 다시 돌린다. startBgm은 재생 중이면 무시하므로 중복 호출은 안전하다.
  const offReady = subscribeAudioReady(() => apply(getAudioSettings()));
  return () => { offSettings(); offReady(); };
}

/**
 * 흐르는 곡을 바꾼다. 화면이 부르는 유일한 곡 선택 지점이다.
 *
 * 재생 중이면 즉시 갈아탄다 — 새 곡의 루프 경계를 기다리지 않는다. 엔딩 진입은 장면 전환이라
 * 이전 곡이 마디를 마칠 때까지 끄는 게 오히려 어색하다.
 *
 * **설정을 무시하지 않는다.** 배경음이 꺼져 있거나 음소거면 곡만 갈아 끼우고 소리는 내지 않는다
 * (startBgm이 그 판단을 갖고 있고, 여기서 다시 계산하면 판단이 두 곳에 생긴다).
 */
export function setBgmTrack(id: BgmId): void {
  if (currentId === id) return;
  currentId = id;
  if (!playing) return;
  stopBgm();
  startBgm();
}

/** 지금 걸린 곡. 화면이 떠날 때 원래 곡으로 되돌리려면 들어올 때 이걸 기억해 둔다. */
export function getBgmTrackId(): BgmId { return currentId; }

/** 테스트·검증용 */
export function getMainTheme(): BgmTrack { return MAIN_THEME; }
export function getBgmTrack(id: BgmId): BgmTrack { return TRACKS[id]; }
export function listBgmTrackIds(): BgmId[] { return Object.keys(TRACKS) as BgmId[]; }
export function __resetBgmForTest(): void { stopBgm(); nextLoopAt = 0; currentId = 'main'; }
