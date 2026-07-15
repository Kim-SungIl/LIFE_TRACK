// ===== Phase 2.1 말걸기 미니 이벤트 — 데이터 모듈 =====
// 순수 데이터: NPC/부모 미니 이벤트 풀, 정적 인사말, 잡담 폴백.
// 로직(필터/픽업/RNG)은 talkSystem.ts. 데이터/로직 분리 P3-9 (2026-05-29).

import { Gender, MemorySlotDraft, ParentStrength, Stats } from '../types';
import type { ParentTag, ParentEffect } from '../parentIntimacy';

// ===== 미니 이벤트 선택지 (Phase 2A) =====
// 부모 미니이벤트의 ±트레이드오프 선택. 도덕 퀴즈가 아니라 "득실 교환"으로 설계.
// 효과는 선택 시점(store.resolveParentTalkChoice)에 적용된다. parentIntimacy는 숨김 스탯이라
// parentEffect(baseDelta+tag)로만 다루고 가시 배지에는 노출하지 않는다.
export interface MiniTalkChoice {
  label: string;                         // 선택 버튼 텍스트 (보통 대사)
  parentEffect?: ParentEffect;           // 부모 친밀도 반응(baseDelta+tag) — 강점 배율·구간 감쇠 적용, UI 미표시
  effects?: {                            // 가시 효과 (배지로 노출)
    stats?: Partial<Stats>;
    fatigue?: number;
    money?: number;
  };
  message: string;                       // 선택 후 결과 한 줄 요약 (UI)
  resultText?: string;                   // 선택 후 본문(없으면 이벤트 description 유지)
  memorySlotDraft?: MemorySlotDraft;     // 이 선택이 학년말/엔딩 회상에 남을 경우(importance≥3)
}

// ===== 미니 이벤트 타입 =====
export interface MiniTalkEvent {
  id: string;                            // 'talk_jihun_30_1' 같이 고유
  npcId?: string;                        // NPC 이벤트
  parentStrength?: ParentStrength;       // 부모 이벤트
  intimacyMin?: number;                  // NPC 친밀도 하한 (이상이어야 풀 진입)
  yearMin?: number;                      // 학년 하한 (예: haeun 졸업 시드 Y6). 시점 의존 시드 게이팅
  yearMax?: number;                      // 학년 상한 (선택적)
  gender?: Gender;                       // 특정 성별 전용 (없으면 양쪽 다 발동)
  description: string;                   // 본문 (NPC/부모 대사 + 상황)
  effects: {
    intimacy?: number;                   // NPC 친밀도 변화
    parentIntimacy?: number;             // 부모 친밀도 변화
    stats?: Partial<Stats>;
    fatigue?: number;
    money?: number;
  };
  message: string;                       // 효과 한 줄 요약 (UI 노출). choices 있으면 발동 시 안내 문구로 사용
  memorySlotDraft?: MemorySlotDraft;     // 70+ 단계: 회상 슬롯 후보 (importance ≥3만 실제 생성)
  parentTag?: ParentTag;                 // 부모 이벤트: 친밀도 반응 태그 (없으면 familyTime). 강점 반응 배율 결정
  choices?: MiniTalkChoice[];            // Phase 2A: ±트레이드오프 선택지. 있으면 선택-후-적용(모달에서 분기)
}

// ===== NPC 미니 이벤트 풀 (Phase 2.1 시드) =====
export const NPC_MINI_EVENTS: MiniTalkEvent[] = [
  {
    id: 'talk_jihun_basket',
    npcId: 'jihun', intimacyMin: 30, gender: 'male',
    description: '"야, 농구장 갈래? 너 들어오면 우리 팀 이긴다."\n지훈이가 어깨를 툭 친다.',
    effects: { intimacy: 2, stats: { health: 1 }, fatigue: 1 },
    message: '지훈이와 한판 — 체력 +1, 친밀도 +2',
  },
  {
    id: 'talk_jihun_badminton',
    npcId: 'jihun', intimacyMin: 30, gender: 'female',
    description: '"야, 라켓 챙겨왔어. 체육관 잠깐 비었대, 한 판만 치자."\n지훈이가 가방에서 셔틀콕을 꺼내 보인다.',
    effects: { intimacy: 2, stats: { health: 1 }, fatigue: 1 },
    message: '지훈이와 배드민턴 한 판 — 체력 +1, 친밀도 +2',
  },
  {
    id: 'talk_subin_problem',
    npcId: 'subin', intimacyMin: 30,
    description: '"이 문제, 답지 봤는데도 풀이가 이해가 안 돼."\n수빈이가 노트를 슥 내민다.',
    effects: { intimacy: 2, stats: { academic: 1 } },
    message: '수빈이와 함께 풀이 — 학업 +1, 친밀도 +2',
  },
  {
    id: 'talk_minjae_notes',
    npcId: 'minjae', intimacyMin: 30,
    description: '"노트 빌려줄까? 어차피 너 보고 나면 내가 다시 정리할 거니까."\n민재가 무심하게 노트를 건넨다.',
    effects: { intimacy: 2, stats: { academic: 1, mental: 1 } },
    message: '민재의 노트 — 학업 +1, 멘탈 +1, 친밀도 +2',
  },
  {
    id: 'talk_yuna_song',
    npcId: 'yuna', intimacyMin: 30,
    description: '"이 노래 들어봐. 너 좋아할 것 같아."\n유나가 이어폰 한쪽을 내민다.',
    effects: { intimacy: 2, stats: { talent: 1, mental: 1 } },
    message: '유나의 추천곡 — 특기 +1, 멘탈 +1, 친밀도 +2',
  },
  {
    id: 'talk_haeun_quiet',
    npcId: 'haeun', intimacyMin: 30,
    description: '"...괜찮아?"\n하은 선배가 자판기 옆에 서서 콜라를 건넨다.\n별 말 없이 옆에 같이 앉는다.',
    effects: { intimacy: 2, stats: { mental: 2 } },
    message: '하은 선배의 침묵 — 멘탈 +2, 친밀도 +2',
  },
  {
    id: 'talk_junha_riceball',
    npcId: 'junha', intimacyMin: 30,
    description: '"이거 어제 만들어 봤어. 한 번 먹어봐."\n준하가 도시락통을 내민다.\n주먹밥에서 김 냄새가 난다.',
    effects: { intimacy: 2, stats: { mental: 1 }, fatigue: -3 },
    message: '준하의 주먹밥 — 멘탈 +1, 피로 -3, 친밀도 +2',
  },
  {
    id: 'talk_doyun_soccer',
    npcId: 'doyun', intimacyMin: 30, gender: 'male',
    description: '"야, 잠깐만. 점심 축구 한 명 비어. 너 와줘야 해."\n도윤이가 가방을 슥 메며 운동장을 가리킨다.',
    effects: { intimacy: 2, stats: { health: 1, social: 1 }, fatigue: 1 },
    message: '도윤이와 점심 축구 — 체력 +1, 사회 +1, 친밀도 +2',
  },
  {
    id: 'talk_doyun_classroom',
    npcId: 'doyun', intimacyMin: 30, gender: 'female',
    description: '"이 책상 같이 옮길까? 혼자 들기엔 좀 무거운 것 같아."\n도윤이가 쉬는 시간을 쪼개 책상 자리를 다시 맞추는 중이다.',
    effects: { intimacy: 2, stats: { social: 1, mental: 1 }, fatigue: 1 },
    message: '도윤이와 책상 옮기기 — 사회 +1, 멘탈 +1, 친밀도 +2',
  },
  // ===== 친밀도 50 단계 (Phase 2.2 — 두 사람만의 일상 코드) =====
  {
    id: 'talk_jihun_50_topping',
    npcId: 'jihun', intimacyMin: 50,
    description: '"네 거 떡볶이에 계란 추가했어. 너 이거 꼭 국물에 부셔 먹잖아."\n지훈이가 당연하다는 듯 일회용 수저를 챙겨 건넨다. 말하지 않아도 내 식성을 꿰고 있는 그의 모습이 익숙하면서도 새삼스럽다.',
    effects: { intimacy: 3, stats: { social: 1 }, fatigue: -1, money: -1 },
    message: '지훈이의 떡볶이 — 사회 +1, 피로 -1, 돈 -1만원, 친밀도 +3',
  },
  {
    id: 'talk_subin_50_sentence',
    npcId: 'subin', intimacyMin: 50,
    description: '"이 문장, 너 생각나서 접어놨어."\n수빈이가 책갈피 대신 살짝 접힌 페이지를 보여준다. 밑줄은 하나뿐인데, 이상하게 그 문장만 오래 눈에 남는다.',
    effects: { intimacy: 3, stats: { academic: 1, mental: 1 } },
    message: '수빈이의 문장 — 학업 +1, 멘탈 +1, 친밀도 +3',
  },
  {
    id: 'talk_minjae_50_wrong_answer_mark',
    npcId: 'minjae', intimacyMin: 50,
    description: '"이 표시 보이면 나중에 다시 보라는 뜻이야." 민재가 오답노트 귀퉁이에 그린 작은 세모를 보여준다.\n"남한텐 안 보여줘. 좀 유치해서."',
    effects: { intimacy: 3, stats: { academic: 1, mental: 1 }, fatigue: 1 },
    message: '민재의 표시법 — 학업 +1, 멘탈 +1, 피로 +1, 친밀도 +3',
  },
  {
    id: 'talk_yuna_50_humming',
    npcId: 'yuna', intimacyMin: 50,
    description: '"방금 이 선율 어때? 너랑 떠들다 보니까 갑자기 생각났어."\n유나가 흥얼거리던 콧노래를 멈추고 연습장에 급히 악보를 그려 넣는다. 그녀의 머릿속에서 막 태어난 멜로디를 가장 먼저 듣는 관객이 된다.',
    effects: { intimacy: 3, stats: { talent: 1, social: 1 } },
    message: '유나의 멜로디 — 재능 +1, 사회 +1, 친밀도 +3',
  },
  {
    id: 'talk_haeun_50_window',
    npcId: 'haeun', intimacyMin: 45,
    description: '"오늘은 대답 안 해도 되는 날."\n하은 선배가 복도 끝 창문을 조금 열어 둔다. 바람이 들어오면, 둘 사이에선 잠깐 쉬어도 된다는 신호가 된다.',
    effects: { intimacy: 3, stats: { mental: 1, social: 1 }, fatigue: -1 },
    message: '하은 선배의 창문 — 멘탈 +1, 사회 +1, 피로 -1, 친밀도 +3',
  },
  {
    id: 'talk_junha_50_seabreeze',
    npcId: 'junha', intimacyMin: 38,
    description: '"이 바람은 좀 부산 같다. 진짜로."\n준하가 교실 창문 틈으로 들어오는 바람을 맡고는 작게 웃는다. 이제 너도 그 말이 그리움인지 농담인지 대충 알아듣는다.',
    effects: { intimacy: 3, stats: { social: 1, mental: 1 }, fatigue: -1 },
    message: '준하의 바람 — 사회 +1, 멘탈 +1, 피로 -1, 친밀도 +3',
  },
  // ===== 친밀도 70 단계 (Phase 2.3 — 속마음 한 조각) =====
  {
    id: 'talk_jihun_70_locker',
    npcId: 'jihun', intimacyMin: 70,
    description: '"나 운동 좋아하는 거랑 공부 싫어하는 거랑 같은 말은 아닌데."\n지훈이가 사물함 문을 괜히 두 번 닫는다. 평소처럼 웃으려다 말고, "가끔은 나도 잘하고 싶은 게 많아" 하고 작게 덧붙인다.',
    effects: { intimacy: 4, stats: { mental: 2 }, fatigue: 1 },
    message: '지훈이의 사물함 앞 말 — 멘탈 +2, 피로 +1, 친밀도 +4',
  },
  {
    id: 'talk_subin_70_night_light',
    npcId: 'subin', intimacyMin: 70,
    description: '"우리 집 거실 불, 밤새 켜두는 날이 있어. 그냥."\n수빈이의 답장이 평소보다 늦게 도착한다. 이모티콘 하나 없는 말풍선인데, 이상하게 오래 꺼지지 않는 불빛 같다.',
    effects: { intimacy: 4, stats: { mental: 2 }, fatigue: -1 },
    message: '수빈이의 늦은 답장 — 멘탈 +2, 피로 -1, 친밀도 +4',
    memorySlotDraft: {
      category: 'discovery',
      importance: 3,
      toneTag: 'melancholy',
      recallText: '수빈이의 늦은 답장과 꺼지지 않던 거실 불빛.',
      npcIds: ['subin'],
    },
  },
  {
    id: 'talk_minjae_70_phone_call',
    npcId: 'minjae', intimacyMin: 70,
    description: '"별일 아니야. 집에서 전화 온 거야."\n민재가 휴대폰 화면을 뒤집어 놓고 물컵만 만지작거린다. "나 가끔은... 기대받는 거 되게 시끄러워." 자랑처럼 말하던 목소리가 처음으로 작아진다.',
    effects: { intimacy: 4, stats: { mental: -1, social: 1 }, fatigue: 1 },
    message: '민재의 뒤집힌 휴대폰 — 사회 +1, 멘탈 -1, 피로 +1, 친밀도 +4',
    memorySlotDraft: {
      category: 'discovery',
      importance: 3,
      toneTag: 'burden',
      recallText: '민재가 휴대폰을 뒤집고 기대가 시끄럽다던 순간.',
      npcIds: ['minjae'],
    },
  },
  {
    id: 'talk_yuna_70_chalk_dust',
    npcId: 'yuna', intimacyMin: 70,
    description: '"잘한다는 말, 좋긴 한데 무서울 때도 있어."\n유나가 칠판 지우개를 털다 말고 손끝의 분필가루를 본다. 곧 다시 웃지만, 그 웃음이 평소보다 조금 늦게 올라온다.',
    effects: { intimacy: 4, stats: { talent: 1, mental: 1 }, fatigue: 1 },
    message: '유나의 분필가루 — 재능 +1, 멘탈 +1, 피로 +1, 친밀도 +4',
  },
  {
    id: 'talk_haeun_70_direction',
    npcId: 'haeun', intimacyMin: 56,
    description: '"후배들이 자꾸 나한테 길을 물어보는데, 사실 나도 여기가 어딘지 모르겠어."\n하은 선배가 계단참에 잠깐 멈춰 난간을 짚는다. "...아는 척하는 것도, 가끔은 길을 잃는 일이더라." 말끝을 흐리곤, 별일 아니라는 듯 다시 계단을 오른다.',
    effects: { intimacy: 4, stats: { mental: 1, social: -1 }, fatigue: -1 },
    message: '하은 선배의 흔들림 — 멘탈 +1, 사회 -1, 피로 -1, 친밀도 +4',
  },
  {
    id: 'talk_junha_70_speech',
    npcId: 'junha', intimacyMin: 44,
    description: '"내 말투 고치면 애들이 덜 쳐다보긴 하거든."\n준하가 급식판 모서리를 젓가락으로 톡톡 친다. "근데 그라면 내가 좀 없어지는 것 같아서, 그게 좀 웃기제." 농담처럼 말하지만 눈은 식판에 남아 있다.',
    effects: { intimacy: 4, stats: { social: 1, mental: 1 }, fatigue: -1 },
    message: '준하의 말투 — 사회 +1, 멘탈 +1, 피로 -1, 친밀도 +4',
  },
  // ===== tier90 코어 (친밀도 80+ 도달 — 80↑ 감쇠 벽 고려해 90→80 하향, Phase 2.4 / importance 5 필수) =====
  {
    id: 'talk_jihun_90_bench',
    npcId: 'jihun', intimacyMin: 80, yearMin: 2,
    description: '"넌 왜 힘들 때 더 실실 웃냐. 바보같이."\n매점 평상, 지훈이가 말없이 이온 음료를 툭 쥐여 준다. "나한텐 힘든 척해도 돼. 내가 힘은 세니까, 대충 다 받아줄 수 있어." 앞만 보며 툭 던지는 목소리에 서툰 다정함이 묻어 있다.',
    effects: { intimacy: 5, stats: { mental: 2 }, fatigue: -2 },
    message: '지훈이가 장난 대신 기댈 어깨를 내밀었다.',
    memorySlotDraft: {
      category: 'growth',
      importance: 5,
      toneTag: 'warm',
      recallText: '매점 평상에서 지훈이가 툭 내밀던 서툰 다정함.',
      npcIds: ['jihun'],
    },
  },
  {
    id: 'talk_subin_90_two_names',
    npcId: 'subin', intimacyMin: 80, yearMin: 2,
    description: '"우리 집 문패엔 이름이 두 개면 돼. 엄마랑 나."\n수빈이는 웃는 얼굴을 조금 늦게 꺼낸다. "이상한 얘기처럼 안 듣는 사람이 필요했는데, 네가 그랬어."',
    effects: { intimacy: 5, stats: { mental: 1, social: 1 }, fatigue: -1 },
    message: '수빈이가 자기 집의 모양을 처음으로 보여줬다.',
    memorySlotDraft: {
      category: 'discovery',
      importance: 5,
      toneTag: 'melancholy',
      recallText: '수빈이가 두 이름의 집을 말하던 순간.',
      npcIds: ['subin'],
    },
  },
  {
    id: 'talk_minjae_90_unmasked',
    npcId: 'minjae', intimacyMin: 80, yearMin: 2,
    description: '"나... 사실 다 괜찮은 척하느라 좀 지쳤나 봐."\n방과후 빈 교실, 민재가 늘 날 서 있던 표정을 슬쩍 푼다. "근데 너 앞에선 안 괜찮아도 되더라. 그게 좀, 이상하게 편해."',
    effects: { intimacy: 5, stats: { mental: 2, social: 1 } },
    message: "민재가 늘 쓰던 '괜찮은 척'을 처음 벗었다.",
    memorySlotDraft: {
      category: 'discovery',
      importance: 5,
      toneTag: 'warm',
      recallText: '민재가 안 괜찮아도 된다던, 그 빈 교실.',
      npcIds: ['minjae'],
    },
  },
  {
    id: 'talk_yuna_90_wrong_note',
    npcId: 'yuna', intimacyMin: 80, yearMin: 2,
    description: '"방금 음, 틀렸는데... 그냥 둘래."\n유나는 악보 위에 지우개를 올려두고도 쓰지 않는다. "이상하게 들려도, 지금 내 소리 같아서."',
    effects: { intimacy: 5, stats: { talent: 1, mental: 2 }, fatigue: 1 },
    message: '유나가 완벽한 음보다 자기 소리를 골랐다.',
    memorySlotDraft: {
      category: 'growth',
      importance: 5,
      toneTag: 'breakthrough',
      recallText: '유나가 틀린 음을 지우지 않던 순간.',
      npcIds: ['yuna'],
    },
  },
  {
    id: 'talk_haeun_90_empty_line',
    npcId: 'haeun', intimacyMin: 62, yearMin: 6,
    description: '"마지막 줄은 비워둘게. 네가 나중에 쓰면 돼."\n졸업을 앞둔 강당, 하은 선배가 짧은 쪽지를 접지 않은 채 건넨다. "내 말로 끝나면, 그건 네 얘기가 아니니까."',
    effects: { intimacy: 5, stats: { mental: 2, talent: 1 }, fatigue: -1 },
    message: '하은 선배가 답 대신 네가 채울 여백을 남겼다.',
    memorySlotDraft: {
      category: 'growth',
      importance: 5,
      toneTag: 'resolve',
      recallText: '하은 선배가 마지막 줄을 비워두던 순간.',
      npcIds: ['haeun'],
    },
  },
  {
    id: 'talk_junha_90_umbrella',
    npcId: 'junha', intimacyMin: 48, yearMin: 6,
    description: '"비 오면 그냥 뛰면 된다 했는데, 같이 있으니까 속도를 맞춰야 되더라."\n준하는 우산 손잡이를 네 쪽으로 조금 더 기울인다. "혼자 빨리 가는 거, 별로 멋있는 일 아이더라."',
    effects: { intimacy: 5, stats: { social: 1, mental: 2 }, fatigue: -1 },
    message: '준하가 혼자 앞서가는 대신 네 걸음에 속도를 맞췄다.',
    memorySlotDraft: {
      category: 'growth',
      importance: 5,
      toneTag: 'warm',
      recallText: '준하가 네 걸음에 속도를 맞추던 순간.',
      npcIds: ['junha'],
    },
  },
  // ===== 신규 3인 (서아·시우·예린) — 캐스트 밸런스 검수 ⑤ 후속: 말걸기 경제 편입 =====
  // seoa는 중1(Y2) 데뷔라 중학 톤(yearMax 4)+고교 톤(yearMin 5) 이중 사다리, siwoo/yerin은 고1 데뷔라 yearMin 5.
  // 중학 톤에 yearMax 4를 둬 고교에서 중학 이벤트가 배열 순서상 고교 톤보다 먼저 뜨던 누수를 차단(학교급별 분리).
  // 70+ 회상 draft는 importance 3 고정(후회카드 편중 방지). 발주: docs/mini-events-new-npc-commission-2026-07-15.md
  {
    id: 'talk_seoa_30_pen_sound',
    npcId: 'seoa', intimacyMin: 30, yearMax: 4,
    description: '"이 펜, 사각거리는 소리 때문에 써. 하나 남는데… 줄까. 아니다, 소리를 나눠 갖자는 게 말이 되나."\n서아가 필통에서 똑같은 펜 한 자루를 꺼내 내민다. 말은 도로 주워 담으면서, 손은 그대로 두고 있다.',
    effects: { intimacy: 2, stats: { mental: 1 } },
    message: '서아의 펜 한 자루 — 멘탈 +1, 친밀도 +2',
  },
  {
    id: 'talk_seoa_50_one_sentence',
    npcId: 'seoa', intimacyMin: 50, yearMax: 4,
    description: '"한 문장만. 다는 아직. …다음 문장이 이것보다 나은데. 방금 말은 취소."\n서아가 손바닥으로 노트를 반쯤 가린 채 한 줄만 보여준다. 다 읽을 때까지 숨을 참고 있다.',
    effects: { intimacy: 3, stats: { mental: 1, talent: 1 } },
    message: '서아의 한 문장 — 멘탈 +1, 재능 +1, 친밀도 +3',
  },
  {
    id: 'talk_seoa_70_diary_and_then',
    npcId: 'seoa', intimacyMin: 70, yearMax: 4,
    description: '"초등학교 때 일기, 전부 \'그리고\'에서 끝냈어. 마침표 찍으면 그날이 진짜 끝나버릴 것 같아서. 검사 도장은 매번 받았지만."\n서아가 픽 웃고는, 웃음이 다 내려가기 전에 창밖으로 고개를 돌린다.',
    effects: { intimacy: 4, stats: { mental: 2 }, fatigue: -1 },
    message: '서아의 마침표 없는 일기 — 멘탈 +2, 피로 -1, 친밀도 +4',
    memorySlotDraft: {
      category: 'discovery',
      importance: 3,
      toneTag: 'melancholy',
      recallText: '마침표를 찍으면 그날이 끝나버릴 것 같다던 일기.',
      npcIds: ['seoa'],
    },
  },
  {
    id: 'talk_seoa_h30_unchanged_pen',
    npcId: 'seoa', intimacyMin: 30, yearMin: 5,
    description: '"고등학교 오니까 다들 펜을 조용한 걸로 바꾸더라. 나만 아직 이거 써."\n서아가 예의 그 사각거리는 펜을 살짝 흔들어 보인다. "…시끄러우면 말해. 아니다, 말해도 안 바꿀 거지만."\n말끝을 흐리면서도, 펜은 이미 노트 위로 돌아가 있다.',
    effects: { intimacy: 2, stats: { mental: 1 } },
    message: '서아의 안 바꾼 펜 — 멘탈 +1, 친밀도 +2',
  },
  {
    id: 'talk_seoa_h50_margin_line',
    npcId: 'seoa', intimacyMin: 50, yearMin: 5,
    description: '"모의고사 끝나기 전에 시간 남으면, 문제지 귀퉁이에 한 줄씩 적어. 다들 답 고치느라 아무도 안 보거든. 제일 조용한 원고지야."\n서아가 문제지를 접어 귀퉁이만 보이게 내민다. 수식 사이에 수식이 아닌 글씨가 한 줄 서 있다.',
    effects: { intimacy: 3, stats: { academic: 1, mental: 1 } },
    message: '서아의 문제지 귀퉁이 — 학업 +1, 멘탈 +1, 친밀도 +3',
  },
  {
    id: 'talk_seoa_h65_reading_person',
    npcId: 'seoa', intimacyMin: 65, yearMin: 5,
    description: '"읽어달라는 말은 아직 좀 이상해."\n서아가 프린트 뒷면에 쓴 짧은 글을 내 쪽으로 밀어놓고 시선은 창밖에 둔다.\n"틀린 데 말고, 멈춘 데만 봐줘."',
    effects: { intimacy: 3, stats: { mental: 1, talent: 1 } },
    message: '서아의 멈춘 데 — 멘탈 +1, 재능 +1, 친밀도 +3',
  },
  {
    id: 'talk_seoa_h80_end_first',
    npcId: 'seoa', intimacyMin: 80, yearMin: 5,
    description: '"이번 건 끝 문장을 먼저 적어놨어. 처음이야, 끝에서 시작하는 거. 이제 거기까지 걸어가기만 하면 돼."\n서아가 노트 뒤쪽을 손끝으로 한 번 누른다. 어디로 가는지 아는 사람의 손짓이다.',
    effects: { intimacy: 4, stats: { mental: 2 } },
    message: '서아의 먼저 적어둔 끝 — 멘탈 +2, 친밀도 +4',
    memorySlotDraft: {
      category: 'growth',
      importance: 3,
      toneTag: 'resolve',
      recallText: '끝 문장을 먼저 적어두고, 거기까지 걸어가겠다던 글.',
      npcIds: ['seoa'],
    },
  },
  {
    id: 'talk_siwoo_30_railing',
    npcId: 'siwoo', intimacyMin: 30, yearMin: 5,
    description: '"여기만 색이 옅어. 다들 마지막 세 칸은 난간 안 잡고 뛰거든."\n시우가 텀블러 든 손으로 계단 난간의 한 뼘을 가리킨다. 방금 세 칸을 뛰어 내려온 나를 보고는, 한 박자 늦게 덧붙인다. "방금 너처럼."',
    effects: { intimacy: 2, stats: { mental: 1 } },
    message: '시우의 난간 한 뼘 — 멘탈 +1, 친밀도 +2',
  },
  {
    id: 'talk_siwoo_50_linked_corridor',
    npcId: 'siwoo', intimacyMin: 50, yearMin: 5,
    description: '"이 통로만 벽돌 색이 다르잖아. 나중에 이은 거야. 매일 비 맞던 누가 있었겠지."\n시우가 구관과 신관 사이 연결 복도의 벽을 손바닥으로 짚는다. "…나는 이런 거 짓고 싶어. 대단한 거 말고, 누가 매일 지나다니는 거."\n말해놓고 본인이 먼저 걸음을 옮긴다.',
    effects: { intimacy: 3, stats: { mental: 2 } },
    message: '시우의 연결 통로 — 멘탈 +2, 친밀도 +3',
  },
  {
    id: 'talk_siwoo_70_dry_route',
    npcId: 'siwoo', intimacyMin: 70, yearMin: 5,
    description: '"너 우산 잘 안 갖고 다니잖아."\n시우가 접은 종이 한 장을 내민다. 교문에서 매점까지, 지붕 이어진 데만 골라 이은 동선이 그려져 있다. "이대로만 밟으면 안 맞아. …시험해 본 사람이 있어." 한 박자 늦게 픽.',
    effects: { intimacy: 4, stats: { mental: 2 }, fatigue: -1 },
    message: '시우의 비 안 맞는 동선 — 멘탈 +2, 피로 -1, 친밀도 +4',
    memorySlotDraft: {
      category: 'discovery',
      importance: 3,
      toneTag: 'warm',
      recallText: '지붕 이어진 데만 골라 이은, 비 안 맞는 동선 한 장.',
      npcIds: ['siwoo'],
    },
  },
  {
    id: 'talk_yerin_30_depreciated_print',
    npcId: 'yerin', intimacyMin: 30, yearMin: 5,
    description: '"이거 너 해. 나한텐 감가 끝난 자료라 폐기 예정이었어."\n예린이 오답 유형 정리 프린트를 책상 위로 밀어 놓는다. 폐기라던 종이엔 오늘 날짜의 형광펜 자국이 아직 마르지도 않았다.',
    effects: { intimacy: 2, stats: { academic: 1 } },
    message: '예린의 폐기 예정 프린트 — 학업 +1, 친밀도 +2',
  },
  {
    id: 'talk_yerin_50_carry_over',
    npcId: 'yerin', intimacyMin: 50, yearMin: 5,
    description: '"오늘 거 정산하자. 네 30분에 내 자료 열람권이면 등가—"\n예린의 펜이 장부 위에서 멈춘다. "…아니다. 이건 항목이 없네." 빈 줄에 적을 말을 못 찾다가, 결국 \'이월\'이라고만 적는다. 뭘 이월하는지는 안 적는다.',
    effects: { intimacy: 3, stats: { academic: 1, mental: 1 } },
    message: '예린의 이월 한 줄 — 학업 +1, 멘탈 +1, 친밀도 +3',
  },
  {
    id: 'talk_yerin_70_missed_bus',
    npcId: 'yerin', intimacyMin: 70, yearMin: 5,
    description: '"방금 그거 타면 환승까지 최적이었는데."\n밤 정류장, 예린이 의자에서 일어나지 않는다. "…네 줄만 왜 미산정인지, 말한 적 없었지. 등급을 매기면 결산이 서고, 결산이 서면 손절가가 생겨." 딱 거기까지만 말하고, 다음 버스가 올 때까지 노선표만 본다.',
    effects: { intimacy: 4, stats: { mental: 2 }, fatigue: 1 },
    message: '예린이 그냥 보낸 버스 — 멘탈 +2, 피로 +1, 친밀도 +4',
    memorySlotDraft: {
      category: 'discovery',
      importance: 3,
      toneTag: 'melancholy',
      recallText: '손절가가 생길까 봐 끝내 값을 매기지 않던 줄 하나.',
      npcIds: ['yerin'],
    },
  },
];

// ===== 부모 미니 이벤트 풀 (Phase 2A — 강점별 1개, ±선택지 트레이드오프) =====
// 각 이벤트는 두 선택지로 분기: 관계를 챙기는 쪽 vs 자기를 지키는 쪽.
// 긍정 선택이 회피보다 매력적이되, 회피도 다른 자원(멘탈·돈·시간)을 보존해 "클릭할 이유"가 있게.
// parentEffect는 숨김 적용(강점 배율·구간 감쇠), effects만 배지로 노출.
// 비중 큰 선택은 memorySlotDraft로 학년말/엔딩 회상에 남는다(importance≥3, sourceEventId당 1회).
// 이벤트 레벨 effects/parentTag는 choices 없는 레거시 폴백용 — choices 있으면 store가 무시한다.
export const PARENT_MINI_EVENTS: MiniTalkEvent[] = [
  {
    id: 'talk_parent_emotional',
    parentStrength: 'emotional',
    description: '"오늘 좀 피곤해 보이네. 힘들면 힘들다고 해."\n엄마가 핫초코를 내려놓는다.',
    effects: { stats: { mental: 1 }, fatigue: -1 },
    parentTag: 'shareWorry',
    message: '엄마가 핫초코를 내려놓는다',
    choices: [
      {
        label: '"사실 요즘 좀 힘들었어." 솔직히 털어놓는다',
        parentEffect: { baseDelta: 1.5, tag: 'shareWorry' },
        effects: { stats: { mental: 1 }, fatigue: -1 },
        message: '마음을 털어놨다 — 멘탈 +1, 피로 -1',
        memorySlotDraft: {
          category: 'reconciliation', importance: 3, toneTag: 'warm',
          recallText: '그날 엄마 앞에서 처음으로 속을 다 꺼냈다.',
        },
      },
      {
        label: '"아냐, 괜찮아." 웃어넘긴다',
        parentEffect: { baseDelta: -0.6, tag: 'hideProblem' },
        effects: {},
        message: '괜찮은 척 웃어넘겼다',
        resultText: '엄마는 더 묻지 않았다. 핫초코만 천천히 식어갔다.',
        memorySlotDraft: {
          category: 'betrayal', importance: 3, toneTag: 'regret',
          recallText: '괜찮다고 웃었지만, 사실은 괜찮지 않았다.',
        },
      },
    ],
  },
  {
    id: 'talk_parent_wealth',
    parentStrength: 'wealth',
    description: '"필요한 거 있으면 말해. 친구들이랑 놀러도 다니고."\n아빠가 지갑에서 지폐를 꺼낸다.',
    effects: { money: 2 },
    parentTag: 'familyTime',
    message: '아빠가 지갑을 연다',
    choices: [
      {
        label: '"고마워요." 받으면서 요즘 얘기를 나눈다',
        parentEffect: { baseDelta: 0.8, tag: 'familyTime' },
        effects: { money: 2 },
        message: '용돈을 받으며 근황을 나눴다 — 💰 +2만원',
        memorySlotDraft: {
          category: 'unspoken_debt', importance: 3, toneTag: 'warm',
          recallText: '말없이 건네진 봉투를 한참 들여다봤다.',
        },
      },
      {
        label: '"이왕이면 좀 더…" 더 달라고 한다',
        parentEffect: { baseDelta: -1.2, tag: 'moneyRequest' },
        effects: { money: 3 },
        message: '용돈을 더 받아냈다 — 💰 +3만원',
        resultText: '아빠는 잠깐 머뭇거리다 한 장을 더 꺼냈다.',
        memorySlotDraft: {
          category: 'bypass', importance: 3, toneTag: 'regret',
          recallText: '필요한 건 늘 손쉽게 돈으로 채워졌다.',
        },
      },
    ],
  },
  {
    id: 'talk_parent_info',
    parentStrength: 'info',
    yearMin: 2,  // QA #5: "전망/학원" 진로 못박기는 중1+ 톤. 초6(Y1)은 잡담(info.elementary "넌 뭐 할 때 재밌어?")이 담당.
    description: '"엄마가 알아봤는데, 그 분야 요즘 전망 좋대."\n메모지에 학원 이름이 빼곡히 적혀 있다.',
    effects: { stats: { academic: 1 } },
    parentTag: 'careerTalk',
    message: '엄마가 메모지를 내민다',
    choices: [
      {
        label: '"오, 그래?" 관심 있게 듣는다',
        parentEffect: { baseDelta: 1.0, tag: 'careerTalk' },
        effects: { stats: { academic: 1 } },
        message: '진로 얘기에 귀 기울였다 — 학업 +1',
        memorySlotDraft: {
          category: 'discovery', importance: 3, toneTag: 'resolve',
          recallText: '엄마가 모아둔 메모지를 그날 처음 끝까지 읽었다.',
        },
      },
      {
        label: '"알겠어요." 적당히 흘려듣는다',
        parentEffect: { baseDelta: -0.8, tag: 'ignoreAdvice' },
        effects: { stats: { mental: 1 } },
        message: '잔소리를 흘려보냈다 — 멘탈 +1',
      },
    ],
  },
  {
    id: 'talk_parent_strict',
    parentStrength: 'strict',
    yearMin: 2,  // QA #5: "이번엔 잘 봐야 한다/11시 취침" 성적압박은 중1+ 톤. 초6(Y1)엔 과함 → 잡담이 담당.
    description: '"이번에는 잘 봐야 한다. 11시까지는 자고."\n아빠가 책상을 한 번 둘러보고 방을 나간다.',
    effects: { stats: { academic: 1, mental: -1 } },
    parentTag: 'gradeImprove',
    message: '아빠가 방을 둘러본다',
    choices: [
      {
        label: '"알겠어요." 책상에 앉는다',
        parentEffect: { baseDelta: 0.6, tag: 'keepPromise' },
        effects: { stats: { academic: 1 } },
        message: '기대에 부응하려 했다 — 학업 +1',
        memorySlotDraft: {
          category: 'growth', importance: 3, toneTag: 'resolve',
          recallText: '아빠 말이 맞았다는 걸, 그땐 인정하기 싫었다.',
        },
      },
      {
        label: '"그만 좀 하세요." 쏘아붙인다',
        parentEffect: { baseDelta: -1.0, tag: 'breakPromise' },
        effects: { stats: { mental: 1 } },
        message: '속내를 터뜨렸다 — 멘탈 +1',
        resultText: '문이 닫히고, 집 안이 한동안 조용했다.',
        memorySlotDraft: {
          category: 'betrayal', importance: 3, toneTag: 'regret',
          recallText: '그만하라 소리치던 밤, 방문이 쾅 닫혔다.',
        },
      },
    ],
  },
  {
    id: 'talk_parent_resilience',
    parentStrength: 'resilience',
    description: '"피곤해 보인다. 그냥 자, 내일 또 있어."\n엄마가 스탠드를 끄고 문을 닫는다.',
    effects: { fatigue: -3 },
    parentTag: 'recoveryAction',
    message: '엄마가 스탠드를 끈다',
    choices: [
      {
        label: '"…그럴게요." 불 끄고 눕는다',
        parentEffect: { baseDelta: 1.0, tag: 'recoveryAction' },
        effects: { fatigue: -3 },
        message: '푹 쉬었다 — 피로 -3',
        memorySlotDraft: {
          category: 'growth', importance: 3, toneTag: 'warm',
          recallText: '그냥 자라던 그 한마디가 오래 마음에 남았다.',
        },
      },
      {
        label: '"조금만 더 할게요." 책상에 남는다',
        parentEffect: { baseDelta: -0.4, tag: 'ignoreAdvice' },
        effects: { stats: { academic: 1 }, fatigue: 1 },
        message: '조금 더 버텼다 — 학업 +1, 피로 +1',
      },
    ],
  },
  {
    id: 'talk_parent_freedom',
    parentStrength: 'freedom',
    description: '"네가 알아서 해. 엄마는 네 결정 응원할게."\n식탁 너머로 잠깐 눈을 마주친다.',
    effects: { stats: { mental: 1 } },
    parentTag: 'autonomyChoice',
    message: '엄마가 눈을 마주친다',
    choices: [
      {
        label: '"내가 정했어요." 스스로 결정해 알린다',
        parentEffect: { baseDelta: 1.2, tag: 'autonomyChoice' },
        effects: { stats: { mental: 1 } },
        message: '내 결정을 말했다 — 멘탈 +1',
        memorySlotDraft: {
          category: 'discovery', importance: 3, toneTag: 'resolve',
          recallText: '내 길은 내가 정하겠다고 처음 입 밖에 냈다.',
        },
      },
      {
        label: '"그냥 엄마가 정해줘요." 미룬다',
        parentEffect: { baseDelta: -1.5, tag: 'ignoreAdvice' },
        effects: { fatigue: -1 },
        message: '결정을 미뤘다 — 피로 -1',
      },
    ],
  },

  // ===== Phase 2B — 강점별 추가 이벤트(다중화, 단조로움 해소) =====
  // 기존 1개와 다른 상황을 다룬다. 밸런스: 긍정에도 가시 보상을 둬 "긍정이 가시적으로 손해"가 안 되게,
  // 회피 페널티는 강점 배율을 곱해 실효 −0.6 이상이 되게(지배전략 방지, 4자 리뷰 교훈).
  {
    id: 'talk_parent_emotional_2',
    parentStrength: 'emotional',
    description: '"요즘 표정이 어둡더라. 친구랑 무슨 일 있어?"\n엄마가 옆자리에 가만히 앉는다.',
    effects: { stats: { mental: 1 } },
    parentTag: 'shareWorry',
    message: '엄마가 옆에 앉는다',
    choices: [
      {
        label: '"사실 멀어진 친구가 있어." 털어놓는다',
        parentEffect: { baseDelta: 1.4, tag: 'shareWorry' },
        effects: { stats: { mental: 1 } },
        message: '속엣말을 꺼냈다 — 멘탈 +1',
        memorySlotDraft: {
          category: 'reconciliation', importance: 3, toneTag: 'warm',
          recallText: '그날 엄마한테 멀어진 친구 얘길 다 했다.',
        },
      },
      {
        label: '"별일 아냐." 화제를 돌린다',
        parentEffect: { baseDelta: -0.6, tag: 'hideProblem' },
        effects: {},
        message: '괜찮은 척 화제를 돌렸다',
        resultText: '엄마는 더 캐묻지 않고, 등을 한 번 쓸어주고 일어섰다.',
        memorySlotDraft: {
          category: 'betrayal', importance: 3, toneTag: 'regret',
          recallText: '괜찮다 했지만, 그 친구가 내내 맴돌았다.',
        },
      },
    ],
  },
  {
    id: 'talk_parent_wealth_2',
    parentStrength: 'wealth',
    description: '"이번에 좋은 거 하나 장만해줄까? 남들 다 있다던데."\n아빠가 카탈로그를 펼친다.',
    effects: { stats: { mental: 1 } },
    parentTag: 'familyTime',
    message: '아빠가 카탈로그를 펼친다',
    choices: [
      {
        label: '"있는 걸로 충분해요." 사양한다',
        parentEffect: { baseDelta: 0.8, tag: 'familyTime' },
        effects: { stats: { mental: 1 }, money: 1 },
        message: '마음만 받았다 — 멘탈 +1, 💰 +1만원',
        resultText: '됐다고 했는데도 아빠는 기어이 만원을 손에 쥐여줬다.',
      },
      {
        label: '"그럼 이것도…" 더 고른다',
        parentEffect: { baseDelta: -0.7, tag: 'overspend' },
        effects: { money: 3 },
        message: '결국 더 받아냈다 — 💰 +3만원',
        memorySlotDraft: {
          category: 'bypass', importance: 3, toneTag: 'regret',
          recallText: '갖고 싶던 걸 또 그냥 손에 넣어버렸다.',
        },
      },
    ],
  },
  {
    id: 'talk_parent_info_2',
    parentStrength: 'info',
    yearMin: 5,
    description: '"엄마가 알아봤는데, 이 학과가 더 안정적이래."\n진학 설명회 자료가 식탁에 펼쳐져 있다.',
    effects: { stats: { academic: 1 } },
    parentTag: 'careerTalk',
    message: '엄마가 진학 자료를 내민다',
    choices: [
      {
        label: '"같이 좀 더 알아봐요." 진지하게 듣는다',
        parentEffect: { baseDelta: 1.0, tag: 'careerTalk' },
        effects: { stats: { academic: 1 } },
        message: '진로를 함께 들여다봤다 — 학업 +1',
        memorySlotDraft: {
          category: 'discovery', importance: 3, toneTag: 'resolve',
          recallText: '엄마가 짚어준 길을 그날 진지하게 들여다봤다.',
        },
      },
      {
        label: '"내가 알아서 정할래요." 선을 긋는다',
        parentEffect: { baseDelta: -0.8, tag: 'ignoreAdvice' },
        effects: { stats: { mental: 1 } },
        message: '내 뜻을 분명히 했다 — 멘탈 +1',
      },
    ],
  },
  {
    id: 'talk_parent_strict_2',
    parentStrength: 'strict',
    description: '"정한 시간까지 들어오기로 했지. 약속이다."\n아빠가 시계를 가리킨다.',
    effects: { fatigue: -1 },
    parentTag: 'keepPromise',
    message: '아빠가 시계를 가리킨다',
    choices: [
      {
        label: '"네, 그때까지 올게요." 약속을 지킨다',
        parentEffect: { baseDelta: 0.8, tag: 'keepPromise' },
        effects: { fatigue: -1 },
        message: '약속을 지켰다 — 피로 -1',
      },
      {
        label: '"오늘만 좀 늦을게요…" 약속을 어긴다',
        parentEffect: { baseDelta: -1.0, tag: 'breakPromise' },
        effects: { stats: { mental: 1 } },
        message: '늦게까지 놀았다 — 멘탈 +1',
        memorySlotDraft: {
          category: 'betrayal', importance: 3, toneTag: 'regret',
          recallText: '약속을 깬 그 밤, 아빠는 말이 없었다.',
        },
      },
    ],
  },
  {
    id: 'talk_parent_resilience_2',
    parentStrength: 'resilience',
    description: '"이번엔 잘 안 됐어도 괜찮아. 다시 하면 되지."\n엄마가 식은 국을 데워 온다.',
    effects: { stats: { mental: 1 } },
    parentTag: 'recoveryAction',
    message: '엄마가 국을 데워 온다',
    choices: [
      {
        label: '"…다시 해볼게요." 마음을 다잡는다',
        parentEffect: { baseDelta: 1.0, tag: 'recoveryAction' },
        effects: { stats: { mental: 1 } },
        message: '다시 일어섰다 — 멘탈 +1',
        memorySlotDraft: {
          category: 'growth', importance: 3, toneTag: 'resolve',
          recallText: '다시 해보자던 그 말에 한 번 더 일어섰다.',
        },
      },
      {
        label: '"이제 그만하고 싶어요." 마음을 접는다',
        parentEffect: { baseDelta: -1.0, tag: 'ignoreAdvice' },
        effects: { fatigue: -1 },
        message: '잠시 손을 놓았다 — 피로 -1',
      },
    ],
  },
  {
    id: 'talk_parent_freedom_2',
    parentStrength: 'freedom',
    description: '"하고 싶은 거 하면 돼. 후회만 없게."\n엄마는 더 말을 보태지 않는다.',
    effects: { stats: { mental: 1 } },
    parentTag: 'autonomyChoice',
    message: '엄마가 말을 아낀다',
    choices: [
      {
        label: '"고마워요. 내가 정할게요." 받아 안는다',
        parentEffect: { baseDelta: 1.2, tag: 'autonomyChoice' },
        effects: { stats: { mental: 1 } },
        message: '내 선택을 책임지기로 했다 — 멘탈 +1',
        memorySlotDraft: {
          category: 'discovery', importance: 3, toneTag: 'resolve',
          recallText: '하고 싶은 걸 해도 된다는 말이 오래 남았다.',
        },
      },
      {
        label: '"뭘 해야 할지 모르겠어요." 떠넘긴다',
        parentEffect: { baseDelta: -1.0, tag: 'ignoreAdvice' },
        effects: { fatigue: -1 },
        message: '결정을 미뤘다 — 피로 -1',
        resultText: '엄마는 "그것도 네 몫이야"라며 더 답해주지 않았다.',
      },
    ],
  },
];

// ===== Phase 4B — 강점별 "절정 순간" =====
// "이 부모라서 좋은 단 한 장면". 강점당 평생 1회(store.parentClimaxFired 가드).
// 미니이벤트와 달리 선택지 없는 단일 컷이라 톤이 분리된다(반복 잡담과 구분).
// 트리거(talkSystem.getEligibleParentClimax): 친밀도 게이트 + triggerTag 누적 + climaxYearMin + 미발동.
//   고3 수능 후 구제 발동창에선 누적 무시(친밀도 normal+면 발동).
// 스탯 퍼주기 금지: strict만 기존 밸런스(멘탈 +2) 유지, 나머지 5축은 스탯 0 — 보상은 회상 슬롯(importance 5).
// 화자 SSOT: 엄마(emotional/info/resilience/freedom) / 아빠(wealth/strict).
export interface ParentClimaxEvent extends MiniTalkEvent {
  parentStrength: ParentStrength;
  triggerTag: ParentTag;     // 누적 자격 태그
  climaxYearMin: number;     // 연령 창 하한
}

export const PARENT_CLIMAX_EVENTS: ParentClimaxEvent[] = [
  {
    id: 'climax_parent_emotional',
    parentStrength: 'emotional', triggerTag: 'shareWorry', climaxYearMin: 2,
    description: '밤 11시, 공부방 문이 5센티쯤 열렸다. 엄마는 아무것도 묻지 않았다.\n핫초코 한 잔이 책상 모서리에 놓였다가, 문이 다시 조용히 닫혔다.',
    effects: {},
    message: '엄마가 말없이 핫초코를 두고 갔다',
    memorySlotDraft: {
      category: 'reconciliation', importance: 5, toneTag: 'warm',
      recallText: '아무것도 묻지 않고 핫초코만 두고 가던 그 밤.',
    },
  },
  {
    id: 'climax_parent_wealth',
    parentStrength: 'wealth', triggerTag: 'familyTime', climaxYearMin: 5,
    description: '아빠 서랍을 열다 내 이름이 적힌 무언가를 봤다. 금액이 아니라, 개설일이 입학식 날인 게 먼저 눈에 들어왔다.\n아빠는 그걸 보더니 "밥은 먹었냐" 하고는 서랍을 닫았다.',
    effects: {},
    message: '아빠는 끝내 그 통장 얘길 하지 않았다',
    memorySlotDraft: {
      category: 'unspoken_debt', importance: 5, toneTag: 'warm',
      recallText: '개설일이 입학식 날이던, 내 이름의 통장.',
    },
  },
  {
    id: 'climax_parent_info',
    parentStrength: 'info', triggerTag: 'careerTalk', climaxYearMin: 4,
    description: '엄마가 자료 더미를 내려놨다. 맨 위에, 내가 흘리듯 한마디 했던 분야가 포스트잇으로 따로 붙어 있었다.\n"강제 아니야. 그냥, 네가 저번에 그랬잖아."',
    effects: {},
    message: '엄마는 내 말을 기억하고 있었다',
    memorySlotDraft: {
      category: 'discovery', importance: 5, toneTag: 'resolve',
      recallText: '내 한마디를 포스트잇으로 붙여둔 자료 더미.',
    },
  },
  {
    id: 'climax_parent_strict',
    parentStrength: 'strict', triggerTag: 'gradeImprove', climaxYearMin: 4,
    description: '성적표를 한참 보던 아빠가, "잘했다" 대신 "…고생했네" 한마디만 남기고 먼저 돌아섰다.\n그 등을 보는데, 왜인지 성적보다 그 말이 오래 남았다.',
    effects: { stats: { mental: 2 } },
    message: '아빠가 "고생했네" 한마디를 남겼다 — 멘탈 +2',
    memorySlotDraft: {
      category: 'growth', importance: 5, toneTag: 'warm',
      recallText: '"고생했네" 한마디 남기고 돌아서던 아빠.',
    },
  },
  {
    id: 'climax_parent_resilience',
    parentStrength: 'resilience', triggerTag: 'recoveryAction', climaxYearMin: 3,
    description: '크게 주저앉은 날, 엄마는 손을 내밀지 않았다. 문 앞에 식은 밥상만 두고 갔다.\n"안 들어갈게. 배고프면 나와." 문이 닫히고도, 발소리는 한참 복도에 남아 있었다.',
    effects: {},
    message: '엄마는 일으키는 대신 기다려줬다',
    memorySlotDraft: {
      category: 'growth', importance: 5, toneTag: 'warm',
      recallText: '문 앞에 식은 밥상을 두고 가던, 그 거리.',
    },
  },
  {
    id: 'climax_parent_freedom',
    parentStrength: 'freedom', triggerTag: 'autonomyChoice', climaxYearMin: 4,
    description: '온 가족이 말리는 선택 앞에서, 엄마만 아무 말이 없었다. 입을 열었다 다시 다물고는—\n"…그래. 네가 정했으면." 말리고 싶은 걸 삼킨 한순간이었다.',
    effects: {},
    message: '엄마는 말리고 싶은 걸 삼켰다',
    memorySlotDraft: {
      category: 'discovery', importance: 5, toneTag: 'resolve',
      recallText: '말리고 싶은 걸 삼키던, 그 한마디.',
    },
  },
];
