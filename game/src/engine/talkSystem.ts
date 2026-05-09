// ===== Phase 2.1 말걸기 미니 이벤트 시스템 =====
// NPC/부모 모달에서 "말 걸기" 시 발동되는 가벼운 미니 이벤트.
// 누적 확률(pressure) 시스템 — 안 만나면 점점 차오르고, 한 번 발동하면 0으로 리셋.
// 1회만 발동(A안) — 이미 발동한 이벤트는 talkEventsFired에 기록되어 풀에서 제외.

import { GameState, Gender, ParentStrength, Stats } from './types';
import { seededRandom } from './rng';

// ===== 미니 이벤트 타입 =====
export interface MiniTalkEvent {
  id: string;                            // 'talk_jihun_30_1' 같이 고유
  npcId?: string;                        // NPC 이벤트
  parentStrength?: ParentStrength;       // 부모 이벤트
  intimacyMin?: number;                  // NPC 친밀도 하한 (이상이어야 풀 진입)
  gender?: Gender;                       // 특정 성별 전용 (없으면 양쪽 다 발동)
  description: string;                   // 본문 (NPC/부모 대사 + 상황)
  effects: {
    intimacy?: number;                   // NPC 친밀도 변화
    parentIntimacy?: number;             // 부모 친밀도 변화
    stats?: Partial<Stats>;
    fatigue?: number;
    money?: number;
  };
  message: string;                       // 효과 한 줄 요약 (UI 노출)
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
];

// ===== 부모 미니 이벤트 풀 (Phase 2.1 시드 — 강점별 1개) =====
export const PARENT_MINI_EVENTS: MiniTalkEvent[] = [
  {
    id: 'talk_parent_emotional',
    parentStrength: 'emotional',
    description: '"오늘 좀 피곤해 보이네. 힘들면 힘들다고 해."\n엄마가 핫초코를 내려놓는다.',
    effects: { parentIntimacy: 2, stats: { mental: 1 }, fatigue: -1 },
    message: '엄마의 따뜻한 한 마디 — 멘탈 +1, 피로 -1',
  },
  {
    id: 'talk_parent_wealth',
    parentStrength: 'wealth',
    description: '"필요한 거 있으면 말해. 친구들이랑 놀러도 다니고."\n아빠가 지갑에서 지폐를 꺼낸다.',
    effects: { parentIntimacy: 2, money: 3 },
    message: '용돈 +3만원',
  },
  {
    id: 'talk_parent_info',
    parentStrength: 'info',
    description: '"엄마가 알아봤는데, 그 분야 요즘 전망 좋대."\n메모지에 학원 이름이 빼곡히 적혀 있다.',
    effects: { parentIntimacy: 2, stats: { academic: 1 } },
    message: '진로 정보 — 학업 +1',
  },
  {
    id: 'talk_parent_strict',
    parentStrength: 'strict',
    description: '"이번에는 잘 봐야 한다. 11시까지는 자고."\n아빠가 책상을 한 번 둘러보고 방을 나간다.',
    effects: { parentIntimacy: 1, stats: { academic: 1, mental: -1 } },
    message: '아빠의 기대 — 학업 +1, 멘탈 -1',
  },
  {
    id: 'talk_parent_resilience',
    parentStrength: 'resilience',
    description: '"피곤해 보인다. 그냥 자, 내일 또 있어."\n엄마가 스탠드를 끄고 문을 닫는다.',
    effects: { parentIntimacy: 2, fatigue: -3 },
    message: '엄마의 무심한 격려 — 피로 -3',
  },
  {
    id: 'talk_parent_freedom',
    parentStrength: 'freedom',
    description: '"네가 알아서 해. 엄마는 네 결정 응원할게."\n식탁 너머로 잠깐 눈을 마주친다.',
    effects: { parentIntimacy: 2, stats: { mental: 1 } },
    message: '선택의 자유 — 멘탈 +1',
  },
];

// ===== 정적 인사말 풀 (대신 사용) — 풀 다 본 후 / pressure 미만 / 친밀도 미달 시 =====
// 기존 getNpcDialogue가 NPC 정적 대사를 처리하므로 여기선 별도 풀 불필요.
// 부모는 정적 대사 풀이 없어 새로 만든다.
const PARENT_STATIC_DIALOGUES: Record<ParentStrength, string[]> = {
  emotional: ['"오늘은 어땠어?"', '"밥은 먹었어?"', '"엄마는 항상 너 응원해."'],
  wealth: ['"용돈 모자라면 말해."', '"너무 무리하지 말고."', '"학원 잘 다녀와."'],
  info: ['"오늘 뉴스 봤어?"', '"이거 한번 읽어봐."', '"요즘 그 진로 어떻대?"'],
  strict: ['"숙제는 했어?"', '"성적표 봤어. 다음엔 더 잘하자."', '"일찍 자라."'],
  resilience: ['"잘 지내."', '"넌 잘 해낼 거야."', '"평소대로 하면 돼."'],
  freedom: ['"알아서 해."', '"잘 다녀와."', '"네 결정이야."'],
};

export function getParentStaticDialogue(state: GameState, strength: ParentStrength): string {
  const pool = PARENT_STATIC_DIALOGUES[strength];
  const idx = Math.floor(seededRandom(state) * pool.length);
  return pool[idx];
}

// ===== 짧은 잡담 폴백 (말 걸었으나 이번 주 이벤트가 사전 결정에서 미발동 시) =====
// 사전 결정 모델 — 미스가 아니라 "이번 주는 별 일 없는 평범한 만남". 클릭마다 캐릭터 톤의 다른 한 줄.
// 톤: 진행 중인 대화 (NPC가 지금 너에게 말 걸고 있는 느낌). "헤어졌다/가버렸다/지나갔다"
//     같은 종결형 묘사 금지. 학교급 종속 표현(야자 등) 금지.
//
// 풀 확장 (2026-05-09): 시드 3개 + Codex 7개 + GPT 일부 = NPC당 8~10개, 강점당 8~9개.
// gender 분기 (2026-05-09): events.ts의 femaleDescription/condition 분기와 톤을 맞추기 위해
//   common(성별 무관) + male/female 풀 구조로 전환. getNpcSmalltalk이 state.gender로 풀 결정.
type NpcSmalltalkPool = { common: string[]; male?: string[]; female?: string[] };

const NPC_SMALLTALK: Record<string, NpcSmalltalkPool> = {
  jihun: {
    common: [
      '"오늘 급식 뭐 나오지? 나 배고파 죽겠어."',
      '"우리 동네에 새 분식집 생겼대. 같이 가볼래?"',
      '"너 달리기 자세 좀 좋아진 것 같은데? 나랑 한번 재볼래?"',
      '"매점 줄 지금 짧대. 지금 가면 우리 이긴다, 가자."',
      '"어제 게임하다가 진짜 웃긴 장면 나왔거든. 너한테 보여주려고 캡처해놨어."',
      '"분식집 아주머니가 우리 얼굴 외운 것 같지 않아? 오늘 가면 서비스 줄지도 몰라."',
      '"너 요즘 좀 조용한데? 무슨 일 있으면 나한테 먼저 말해도 돼."',
      '"오늘 체육 있었으면 좋겠다. 가만히 앉아 있으니까 몸이 근질근질해."',
    ],
    male: [
      '"야 너 어제 그 농구 경기 봤어? 막판에 진짜 대박이었어."',
      '"야, 오늘 끝나고 잠깐만 공 던지고 갈래? 딱 한 판만."',
      '"나 오늘 왠지 컨디션 좋다. 네가 패스만 잘 주면 완전 가능해."',
    ],
    female: [
      '"라켓 챙겼어? 체육관 잠깐 비었대, 한 판만 치자."',
      '"너 스매시 좀 늘었더라, 진짜로."',
      '"방과 후에 셔틀콕 한 통만 사서 칠래? 내가 살게."',
      '"우리 어릴 때 배드민턴 친 거 기억나? 그땐 네트도 없었잖아."',
    ],
  },
  subin: {
    common: [
      '"이번 주 숙제 진짜 많지 않아? 나 아직 절반도 못 했어."',
      '"이 책 봤어? 빌려줄까? 너도 좋아할 것 같아."',
      '"우리 학원 같은 시간대에 하잖아. 같이 갈래?"',
      '"나 오늘 이상하게 말이 많아지는 날이야. 너는 들어줄 준비 됐어?"',
      '"이 문장 좀 예쁘지 않아? 읽다가 너 생각나서 표시해놨어."',
      '"친구들이랑 있다가도 가끔 조용한 데 가고 싶을 때 있지 않아?"',
      '"너 이거 좋아할 것 같아서 빌려왔어. 부담 갖지 말고 한번 봐."',
      '"오늘 같이 가면 안 돼? 혼자 가기엔 길이 좀 심심해서."',
      '"나 사람들 이름은 잘 외우는데, 가끔 내 마음은 잘 모르겠더라."',
      '"너랑 이야기하면 이상하게 정리가 돼. 방금 그 얘기 조금만 더 해줘."',
      '"이거 필기 정리하다가 네 생각났어. 너한테도 도움 될 것 같아서."',
      '"너는 친구 많아 보이는데도 가끔 혼자 있고 싶을 때 있어?"',
    ],
  },
  minjae: {
    common: [
      '"수학 7번 풀이 봤어? 답지 봐도 잘 모르겠더라."',
      '"너 시험 범위 어디까지 봤어? 나는 아직 멀었어."',
      '"이번 주말에 뭐 해? 같이 도서관 갈래?"',
      '"이 문제, 답은 맞았는데 풀이가 마음에 안 들어. 너는 어떻게 생각해?"',
      '"나 안 피곤해 보여? 그럼 성공이네. 오늘은 티 안 나게 버티는 중이야."',
      '"계획표는 세웠는데, 계획표대로 사는 건 또 다른 문제더라."',
      '"네가 설명하면 가끔 더 쉽게 들려. 이 부분만 다시 말해줄래?"',
      '"잠깐 쉬는 것도 효율에 포함해야겠지? 이론상으로는 그래."',
      '"이번엔 실수 줄이는 게 목표야. 어려운 문제보다 쉬운 문제에서 틀리는 게 더 아깝거든."',
      '"너는 모르는 거 바로 물어보는 편이야? 난 그게 아직 좀 어렵더라."',
      '"너 어제 몇 시에 잤어? 나는 일찍 잤다고 말하고 싶은데, 양심이 좀 찔려."',
    ],
    female: [
      '"체육시간에 너 서브 좀 잘 들어가더라. 팔 쓰는 각도가 좋아."',
      '"옆 코트에서 보니까 너 의외로 잘 뛰던데. 평소엔 조용해 보이는데."',
    ],
  },
  yuna: {
    common: [
      '"나 어제 진짜 좋은 노래 발견했어. 한번 들어볼래?"',
      '"너 요즘 뭐 보고 있어? 나 추천 좀 해줘."',
      '"오늘 하늘 너무 예쁘지 않아? 사진 찍어놨어."',
      '"나 방금 좋은 리듬 생각났어. 책상 두드려도 너무 시끄럽진 않겠지?"',
      '"오늘 너 표정 괜찮다. 뭔가 좋은 일 있었어?"',
      '"이 색 예쁘지 않아? 그냥 보면 기분 좋아지는 색이 있어."',
      '"나 웃고 있으면 다 괜찮아 보이나 봐. 근데 진짜 괜찮은지는 나도 모르겠어."',
      '"너랑 있으면 말이 빨라져. 내가 너무 많이 말하면 말해줘."',
      '"이번에 들은 노래가 계속 머리에 맴돌아. 너도 한번 들어볼래?"',
      '"실수해도 티 안 내는 연습 중이야. 방금 티 났어?"',
      '"나 칭찬받으면 좋은데, 그다음부터 더 잘해야 할 것 같아서 이상해."',
      '"너는 긴장될 때 어떻게 해? 나는 웃고 있는데 손이 먼저 떨리더라."',
    ],
  },
  doyun: {
    common: [
      '"쉬는 시간이 진짜 짧다. 5분만 더 있으면 한 골 넣을 텐데."',
      '"오늘 단체사진 찍는다는데, 너 빠지면 한 자리 비잖아."',
      '"사물함 또 안 닫혀? 한번 봐줄게, 별거 아니야."',
      '"선생님이 또 나한테 심부름 시키신다. 뭐, 괜찮아."',
      '"엄마가 또 학원 늘리려 하시는데... 뭐 어쩔 수 있나."',
      '"야, 너 어제 일찍 갔지? 애들이 너 찾더라."',
      '"무릎 좀 까졌는데 별로 안 아파. 진짜야, 멀쩡해."',
    ],
    male: [
      '"야! 점심에 축구 나갈래? 한 명 모자라."',
      '"체육 시간에 너랑 같은 팀 하자고 말해놨어. 괜찮지?"',
      '"운동회 계주 한 자리 비었어. 너 한번 뛰어볼래?"',
    ],
    female: [
      '"양동이 좀 무거워 보이던데, 같이 들고 갈래?"',
      '"이거 책상 같이 옮기자, 혼자 들기엔 좀 무거운 것 같아."',
      '"우리 반 응원 좀 도와줄래? 오늘따라 다들 미적지근하더라고."',
      '"청소 끝났어? 운동장 한 바퀴만 같이 돌까, 햇볕이 너무 좋아서."',
    ],
  },
  haeun: {
    common: [
      '"...너 요즘 잘 지내? 잘 안 보이더라."',
      '"너무 무리하지 마. 그러다 진짜 쓰러져."',
      '"이거 자판기에서 하나 뽑았는데, 너도 마실래?"',
      '"너, 오늘은 좀 천천히 걸어. 계속 앞만 보고 가는 것 같아서."',
      '"괜찮다고 말하는 애들이 제일 안 괜찮을 때가 있더라. 너는 어때?"',
      '"나도 잘하는 척할 때 많아. 그러니까 너도 너무 완벽한 척 안 해도 돼."',
      '"이거 마셔. 단 거 먹으면 잠깐은 생각이 느려져."',
      '"선배라고 다 아는 건 아닌데, 적어도 들어주는 건 할 수 있어."',
      '"요즘 네가 애쓰는 거 보여. 모르는 척하려다가 그냥 말해주는 거야."',
      '"잠깐 앉았다 갈래? 대단한 얘기 안 해도 괜찮아."',
      '"후배님, 오늘은 너무 애쓰지 말고 숨 좀 쉬어. 진짜로."',
      '"너 가끔 나보다 어른스러워 보이는데, 그래도 혼자 다 참지는 마."',
    ],
  },
  junha: {
    common: [
      '"오늘 점심 뭐 나오지? 학식 별로면 우리 매점 갈까?"',
      '"엄마가 어제 만두 만들었거든. 내일 좀 싸올까?"',
      '"...너 부산 와본 적 있어? 한번 와봐, 진짜야."',
      '"내 말투 아직 좀 낯설제? 그래도 듣다 보면 정든다, 진짜로."',
      '"오늘 도시락 좀 많이 싸왔는데, 니 한 입 먹어볼래?"',
      '"여기 길 아직 헷갈린다. 니 시간 되면 매점까지 같이 가주라."',
      '"내가 만든 주먹밥 모양은 좀 그런데 맛은 괜찮다. 믿어도 된다."',
      '"전학 오니까 별것도 아닌 말 거는 게 어렵더라. 니는 좀 편하다."',
      '"부산 바다 냄새가 가끔 생각난다. 여긴 바람이 좀 다르네."',
      '"니 오늘 표정 와 그라노? 말하기 싫으면 밥부터 먹고 얘기하자."',
      '"내가 요리 하나는 좀 한다. 다음에 먹어보고 솔직하게 말해줘라."',
    ],
  },
};

const PARENT_SMALLTALK: Record<ParentStrength, string[]> = {
  emotional: [
    '"오늘은 어땠어? 무슨 일 있었어?"',
    '"엄마가 핫초코 만들었어. 좀 마실래?"',
    '"피곤해 보이네. 좀 쉬어야 하지 않아?"',
    '"오늘 얼굴 보니까 조금 지친 것 같은데, 무슨 일 있었어?"',
    '"말하기 싫은 날이면 그냥 옆에만 있어도 돼."',
    '"밥 먹으면서 천천히 얘기할래? 엄마는 시간 괜찮아."',
    '"네가 힘든 걸 꼭 잘 설명하지 못해도 괜찮아."',
    '"아빠가 보기엔 너 요즘 꽤 애쓰고 있어. 스스로도 좀 알아줬으면 좋겠다."',
    '"오늘은 잘한 일 하나만 말해줄래? 작은 것도 좋아."',
    '"쉬고 싶으면 쉬어도 돼. 무너지는 것보다 멈추는 게 나을 때도 있어."',
    '"엄마는 네가 잘하는 것도 좋지만, 힘든 걸 말해주는 게 더 고마워."',
    '"오늘은 꼭 뭔가를 해내지 않아도 돼. 그냥 쉬어도 괜찮아."',
  ],
  wealth: [
    '"용돈 부족하지 않아? 책이라도 좀 사 봐."',
    '"이번 주말에 가족 외식할까? 먹고 싶은 거 골라."',
    '"필요한 거 있으면 언제든 말해."',
    '"필요한 문제집 있으면 말해. 바로 주문해줄게."',
    '"친구들이랑 뭐 먹고 싶으면 용돈 조금 더 줄까?"',
    '"이번 주말에 맛있는 거 먹으러 갈래? 네가 고르면 거기로 가자."',
    '"가방이 좀 낡은 것 같은데, 마음에 드는 거 있으면 같이 보자."',
    '"공부할 때 불편한 거 없어? 책상이나 의자도 한번 봐줄게."',
    '"준비물 때문에 눈치 보지 말고 필요한 건 미리 말해."',
    '"아빠가 데려다줄 수 있어. 멀면 괜히 힘 빼지 말고 말해."',
    '"필요한 건 참지 말고 말해. 꼭 비싼 게 아니어도 괜찮아."',
  ],
  info: [
    '"이 책 한번 읽어봐. 너한테 도움될 거야."',
    '"엄마가 알아본 학원 있는데, 한번 가볼래?"',
    '"오늘 뉴스에서 그 분야 기사 봤어. 전망 좋다더라."',
    '"이 영상 설명이 꽤 좋더라. 시간 날 때 한번 봐볼래?"',
    '"요즘은 선택지가 많아서, 먼저 정보를 모아보는 게 중요해."',
    '"엄마가 관련 자료를 몇 개 찾아봤는데, 네 생각도 들어보고 싶어."',
    '"그 분야는 길이 하나만 있는 게 아니더라. 같이 비교해볼까?"',
    '"공부법도 사람마다 맞는 게 다르대. 너한테 맞는 방식을 찾아보자."',
    '"이번 설명회는 부담 없이 들어만 봐도 괜찮을 것 같아."',
    '"아빠가 기사 하나 보내놨어. 읽고 별로면 왜 별로인지도 얘기해줘."',
    '"엄마가 자료 몇 개 모아뒀어. 부담 갖지 말고 필요할 때만 봐."',
    '"아빠 생각엔 지금은 결과보다 패턴을 보는 게 더 중요해."',
  ],
  strict: [
    '"숙제 다 했어? 안 했으면 지금 해."',
    '"이번 시험 잘 봐야 한다. 알지?"',
    '"방 좀 정리해라. 책상이 그게 뭐냐."',
    '"오늘 하기로 한 건 어디까지 끝냈어? 확인만 하고 넘어가자."',
    '"방이 어수선하면 마음도 흐트러져. 책상부터 정리하자."',
    '"쉬는 건 좋은데, 해야 할 일을 미루는 핑계가 되면 안 돼."',
    '"이번 주 계획표 다시 보자. 너무 느슨한 부분이 있어."',
    '"약속한 시간은 지켜야지. 그게 기본이야."',
    '"틀린 문제는 그냥 넘기지 마. 왜 틀렸는지까지 봐야 해."',
    '"지금 힘든 건 알아. 그래도 기준은 무너지면 안 돼."',
    '"엄마가 잔소리하는 이유 알지? 네가 할 수 있다고 믿으니까 그래."',
    '"아빠는 결과보다 태도를 본다. 오늘 네가 얼마나 집중했는지가 중요해."',
  ],
  resilience: [
    '"피곤해 보이네. 너무 무리하지 마."',
    '"넌 잘 할 거야. 평소대로만 해."',
    '"오늘은 일찍 자. 내일 또 있어."',
    '"밥 먹었으면 됐다. 너무 복잡하게 생각하지 말고 하나씩 해."',
    '"오늘은 일찍 자자. 몸이 버텨야 마음도 버틴다."',
    '"실수 좀 했다고 끝나는 거 아니야. 다시 하면 돼."',
    '"밖에 잠깐 걷고 와. 머리로만 붙잡고 있으면 더 꼬여."',
    '"괜찮아, 너 생각보다 단단해. 너무 겁먹지 마."',
    '"안 되는 날도 있지. 그런 날은 기본만 하고 넘기자."',
    '"일단 씻고 밥 먹어. 그다음에 생각해도 늦지 않아."',
    '"괜찮아. 그런 날도 있는 거지."',
    '"네가 생각보다 단단한 애인 건 엄마가 알아."',
  ],
  freedom: [
    '"네가 알아서 잘 하잖아."',
    '"이번 주말에 뭐 할 거야? 알아서 정해."',
    '"네 결정이라면 엄마는 응원해."',
    '"네가 정해봐. 대신 왜 그렇게 하고 싶은지는 한번 생각해보고."',
    '"엄마가 대신 골라주진 않을게. 필요하면 같이 들어줄 수는 있어."',
    '"네 방식으로 해보고 싶으면 해봐. 결과도 같이 보면 되지."',
    '"이번 주말 계획은 네가 세워봐. 너무 무리하지만 않으면 돼."',
    '"아빠는 네 판단을 믿어. 막히면 그때 얘기하자."',
    '"남들이 다 한다고 꼭 너도 해야 하는 건 아니야."',
    '"네가 좋아하는 쪽으로 가도 돼. 다만 네 마음을 속이진 않았으면 좋겠다."',
    '"엄마가 다 정해주면 편하긴 한데, 그게 꼭 좋은 건 아니잖아."',
    '"네 생활은 네가 제일 잘 알 거야. 엄마는 옆에서 볼게."',
  ],
};

function pickRandomLine(state: GameState, pool: string[]): string {
  if (pool.length === 0) return '오늘은 별 다른 일 없이 지나갔다.';
  const idx = Math.floor(seededRandom(state) * pool.length);
  return pool[idx];
}

export function getNpcSmalltalk(state: GameState, npcId: string): string {
  const entry = NPC_SMALLTALK[npcId];
  if (!entry) return pickRandomLine(state, []);
  // common + 현재 성별 풀을 합쳐서 한 줄 픽 (events.ts 분기와 톤 일치)
  const genderPool = state.gender === 'female' ? entry.female ?? [] : entry.male ?? [];
  return pickRandomLine(state, [...entry.common, ...genderPool]);
}

export function getHomeSmalltalk(state: GameState): string {
  // 가정은 단일 엔티티 — 두 부모 강점 풀에서 RNG로 한 줄 픽
  const pools = state.parents
    .map(p => PARENT_SMALLTALK[p] ?? [])
    .flat();
  return pickRandomLine(state, pools);
}

// ===== 풀 필터 — store에서 사전 결정 결과로 미니 이벤트 픽업 =====
export function getAvailableNpcEvents(state: GameState, npcId: string): MiniTalkEvent[] {
  const npc = state.npcs.find(n => n.id === npcId);
  if (!npc) return [];
  return NPC_MINI_EVENTS.filter(e =>
    e.npcId === npcId
    && (!e.intimacyMin || npc.intimacy >= e.intimacyMin)
    && (!e.gender || e.gender === state.gender)
    && !state.talkEventsFired.includes(e.id),
  );
}

export function getAvailableHomeEvents(state: GameState): MiniTalkEvent[] {
  // 가정은 두 부모 강점 풀 합집합에서 픽업
  return PARENT_MINI_EVENTS.filter(e =>
    e.parentStrength
    && state.parents.includes(e.parentStrength)
    && !state.talkEventsFired.includes(e.id),
  );
}

// ===== 부모 친밀도 회고 톤 (학년말 일기장 변주) =====
export function getParentIntimacyTone(parentIntimacy: number): 'distant' | 'normal' | 'warm' {
  if (parentIntimacy < 30) return 'distant';
  if (parentIntimacy >= 70) return 'warm';
  return 'normal';
}
