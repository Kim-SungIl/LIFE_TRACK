import { GameEvent, GameState } from '../types';
import { seededRandom } from '../rng';
import { ANNUAL_EVENT_IDS } from '../memorySystem';
import { isExamPeriod } from '../examSystem';
import {
  FOLLOWUP_EVENT_IDS,
  DIRECT_SEQUEL_IDS,
  HARD_CRISIS_IDS,
  SOFT_CRISIS_IDS,
} from './constants';
import {
  HAEUN_EVENTS,
  JIHUN_EVENTS,
  SUBIN_EVENTS,
  MINJAE_EVENTS,
  YUNA_EVENTS,
  JUNHA_EVENTS,
  DOYUN_FIRST_MEET_M,
  DOYUN_FIRST_MEET_F,
  DOYUN_DAILY,
  DOYUN_GRADUATION,
  DOYUN_SCHOOL_SPLIT,
} from './npc';

// 외부 호환 re-export — store.ts, gameEngine.ts 등 기존 `from './events'` import 경로 유지
export {
  FOLLOWUP_EVENT_IDS,
  DIRECT_SEQUEL_IDS,
  HARD_CRISIS_IDS,
  SOFT_CRISIS_IDS,
};

export const GAME_EVENTS: GameEvent[] = [
  // ===== 초반 이벤트 (W1~W4) =====
  // ===== 초6 첫날 (Y1 W1) — 소꿉친구 지훈이랑 또 같은 반 =====
  {
    id: 'first-week',
    title: '새 학기 첫날',
    description: '새 학기 첫날. 교실에 들어서자마자 뒤에서 "야!" 하는 소리.\n돌아보니 지훈이가 농구공을 옆구리에 낀 채 달려온다.\n"우리 또 같은 반이다? 3년 연속이야!"\n싱글벙글 웃는 얼굴이 어릴 때랑 똑같다.\n"방과 후에 한 판 어때? 오랜만에 뛰자."',
    week: 1,
    condition: (s) => s.year === 1,
    location: 'classroom',
    background: 'classroom_elementary_spring',
    speakers: ['jihun'],
    choices: [
      {
        text: '"좋아! 운동장에서 보자"',
        effects: { social: 2, health: 2, mental: 3 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }],
        message: '방과 후에 운동장에서 뛰었다. 지훈이랑 같이 놀면 항상 편하다. "넌 역시 최고야!"',
      },
      {
        text: '"오늘은 좀 피곤해..." — 다음에 하자고 한다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '지훈이가 "알겠어, 그럼 내일!" 쿨하게 넘겼다. 소꿉친구라 이런 게 편하다.',
      },
      {
        text: '"대신 같이 숙제 하자" — 공부 제안',
        effects: { academic: 2, social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '지훈이가 "으, 숙제? ...알겠어, 같이 하면 그나마 낫겠지." 공부는 싫어하지만 친구 부탁은 못 거절한다.',
      },
    ],
    // 여자 버전: 배드민턴 (기존 컨벤션)
    femaleDescription: '새 학기 첫날. 교실에 들어서자마자 뒤에서 "야!" 하는 소리.\n돌아보니 지훈이가 배드민턴 라켓을 어깨에 걸친 채 달려온다.\n"우리 또 같은 반이다? 3년 연속이야!"\n싱글벙글 웃는 얼굴이 어릴 때랑 똑같다.\n"방과 후에 배드민턴 어때? 오랜만에 한 판 치자."',
    femaleChoices: [
      {
        text: '"좋아! 체육관에서 보자"',
        effects: { social: 2, health: 2, mental: 3 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }],
        message: '방과 후에 체육관에서 배드민턴 쳤다. 지훈이랑 놀면 항상 편하다. "야 너 잘 치네!"',
      },
      {
        text: '"오늘은 좀 피곤해..." — 다음에 하자고 한다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '지훈이가 "알겠어, 그럼 내일!" 쿨하게 넘겼다. 소꿉친구라 이런 게 편하다.',
      },
      {
        text: '"대신 같이 숙제 하자" — 공부 제안',
        effects: { academic: 2, social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '지훈이가 "으, 숙제? ...알겠어, 같이 하면 그나마 낫겠지." 공부는 싫어하지만 친구 부탁은 못 거절한다.',
      },
    ],
  },
  // ===== 옆자리 민재 (Y1 W2) — 새 짝꿍 =====
  {
    id: 'minjae-meet-elementary',
    title: '새 짝꿍',
    description: '새 자리 배치. 옆자리에 처음 보는 애가 앉았다.\n필통을 가지런히 꺼내놓고, 노트에 오늘 날짜를 정자로 적는다.\n쉬는 시간에 조심스럽게 말을 건다.\n"야, 점심 같이 먹을래? 나 박민재."',
    week: 2,
    condition: (s) => s.year === 1,
    location: 'classroom',
    background: 'classroom_elementary_spring',
    speakers: ['minjae'],
    choices: [
      {
        text: '"좋아!" — 같이 먹으러 간다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '민재와 점심을 먹었다. 조용한 줄 알았는데 의외로 유쾌한 애다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '초6 봄, 민재와 처음 같이 먹은 급식의 낯선 편안함.',
          npcIds: ['minjae'],
        },
      },
      {
        text: '"...응, 잘 부탁해" — 같이 가며 이야기한다',
        effects: { social: 1, academic: 1, mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 4 }],
        message: '급식실에서 같이 먹으며 이야기 나눴다. 조용한데 막상 얘기해보면 은근 디테일에 꼼꼼한 애다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '민재의 노트 정자(正字)를 보며 "이상한 애네" 생각했던 날.',
          npcIds: ['minjae'],
        },
      },
      {
        text: '"아... 나 할 거 있어서" — 혼자 도서관에 간다',
        effects: { academic: 1, mental: -1 },
        message: '도서관에서 조용히 시간을 보냈다. 편하긴 한데... 좀 외롭다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 5,
          toneTag: 'regret',
          recallText: '처음 내민 손을 피한 점심시간. 도서관 창밖이 유난히 멀었다.',
          npcIds: ['minjae'],
        },
      },
    ],
  },
  // ===== 유나 첫 만남 (Y1 W6) — 같은 반 모범생 =====
  {
    id: 'yuna-meet-elementary',
    title: '도서관 창가 자리',
    description: '쉬는 시간에 도서관에 갔다. 창가 자리에 같은 반 여자애가 혼자 책을 읽고 있다.\n머리핀에 작은 별 장식. 피아노 학원 가방이 의자에 걸려 있다.\n나를 보더니 살짝 웃어준다.\n"아, 너도 책 좋아해?"',
    week: 6,
    condition: (s) => s.year === 1,
    location: 'library',
    background: 'library_elementary',
    speakers: ['yuna'],
    choices: [
      {
        text: '"응, 나도 가끔 읽어" — 같이 책 얘기한다',
        effects: { academic: 1, social: 1, mental: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 5 }],
        message: '유나랑 책 얘기했다. 유나가 추천해 준 책이 있는데, 재밌어 보인다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '초6 도서관 창가, 유나가 추천해준 책 제목을 종이 귀퉁이에 적던 순간.',
          npcIds: ['yuna'],
        },
      },
      {
        text: '"피아노 배워? 멋있다!"',
        effects: { social: 2, mental: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 4 }],
        message: '유나가 "엄마가 시켜서 하는 건데..." 하면서도 입가에 웃음. 피아노 연주회 얘기도 해줬다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '"엄마가 시켜서"라고 말하면서도 웃던 유나의 얼굴.',
          npcIds: ['yuna'],
        },
      },
      {
        text: '"난 책 잘 안 봐" — 솔직히 말한다',
        effects: { mental: 0 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '유나가 "괜찮아, 그럴 수도 있지" 하며 다시 책으로 돌아갔다. 약간 어색했다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 4,
          toneTag: 'regret',
          recallText: '도서관 창가에서 유나가 책으로 돌아섰다. 어색한 침묵이 길었다.',
          npcIds: ['yuna'],
        },
      },
    ],
  },
  // ===== 수빈 첫 만남 (Y1 W10) — 학원 친구 =====
  {
    id: 'subin-meet-elementary',
    title: '학원 뒷자리',
    description: '학원 쉬는 시간. 뒷자리 여자애가 내 책을 힐끔 본다.\n단정한 단발머리, 작은 별 귀걸이. 손에는 작은 노트를 들고 있다.\n"너도 이 문제집 풀어? 나 여기 막혔는데..."\n공책을 살며시 내밀어 보인다.',
    week: 10,
    condition: (s) => s.year === 1,
    location: 'classroom',
    background: 'hagwon_front',
    speakers: ['subin'],
    choices: [
      {
        text: '"어, 이거 나도 어렵더라" — 같이 푼다',
        effects: { academic: 2, social: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 5 }],
        message: '수빈이랑 같이 문제를 풀었다. 조용한데 꼼꼼한 애다. 모르는 걸 솔직히 말할 줄 안다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '학원 뒷자리, 수빈이 공책에 같이 그린 화살표와 동그라미들.',
          npcIds: ['subin'],
        },
      },
      {
        text: '"이거? 이렇게 푸는 거야" — 설명해준다',
        effects: { academic: 1, social: 2, mental: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '수빈이가 "아, 그렇구나! 고마워" 하며 노트에 꼼꼼히 적었다. 누굴 도와주는 게 생각보다 뿌듯하다.',
        memorySlotDraft: {
          category: 'courage',
          importance: 5,
          toneTag: 'resolve',
          recallText: '수빈이 앞에서 또박또박 설명하던 날, 내 목소리가 낯설게 단단했다.',
          npcIds: ['subin'],
        },
      },
      {
        text: '"나도 막혔어..." — 같이 고민한다',
        effects: { social: 2, mental: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 3 }],
        message: '같이 끙끙대다가 둘 다 모른다는 걸 깨닫고 웃었다. 그래도 이상하게 친해진 기분이다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '둘 다 모른다는 걸 깨닫고 웃던 학원 쉬는 시간.',
          npcIds: ['subin'],
        },
      },
    ],
  },
  ...DOYUN_FIRST_MEET_M,
  ...DOYUN_FIRST_MEET_F,
  ...DOYUN_DAILY,
  ...DOYUN_GRADUATION,
  // ===== 초등학교 졸업 (Y1 W46) =====
  {
    id: 'elementary-graduation',
    title: '초등학교 졸업식',
    description: '졸업식 날이다. 강당에 모인 아이들 표정이 다 다르다.\n웃는 애, 우는 애, 멍한 애.\n6년간 다니던 학교를 떠난다.\n교문을 나서며 뒤를 돌아본다.',
    week: 46,
    condition: (s) => s.year === 1,
    location: 'auditorium',
    background: 'auditorium_elementary',
    speakers: ['jihun', 'minjae'],
    choices: [
      {
        text: '친구들과 사진을 찍는다',
        effects: { social: 3, mental: 4 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }, { npcId: 'minjae', intimacyChange: 1 }],
        message: '"중학교 가서도 연락하자!" 지훈이가 웃으며 말했다. 좀 울컥했다.',
      },
      {
        text: '조용히 교실을 둘러본다',
        effects: { mental: 5 },
        message: '빈 교실에 혼자 서 있었다. 칠판, 책상, 창밖 풍경... 다 기억에 남을 것 같다.',
      },
      {
        text: '"빨리 중학교 가고 싶다!" — 앞만 본다',
        effects: { mental: 2, academic: 1 },
        message: '초등학교는 끝났다. 이제 새로운 시작이다!',
      },
    ],
  },
  // ===== 중학교 입학 (Y2 W1) =====
  {
    id: 'middle-school-entrance',
    title: '중학교 입학식',
    description: '새 교복을 입고 교문을 들어선다. 모든 게 다르다.\n건물도 크고, 선배도 있고, 교실 번호도 낯설다.\n심장이 빨리 뛴다. 긴장되면서도 설렌다.\n"...나 여기서 잘 할 수 있겠지?"',
    week: 1,
    condition: (s) => s.year === 2,
    location: 'auditorium',
    background: 'school_gate_middle',
    speakers: ['subin'],
    choices: [
      {
        text: '옆자리 아이에게 먼저 말을 건다',
        effects: { social: 3, mental: 3 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 3 }],
        message: '"야, 여기 진짜 크다! 같이 다니자~" 수빈이가 팔짱을 끼며 웃었다. 나만 긴장한 건가.',
      },
      {
        text: '일단 자리에 앉아서 주변을 살핀다',
        effects: { mental: 2 },
        message: '낯선 얼굴들 사이에서 아는 얼굴을 찾았다. 옆에선 수빈이가 신나서 두리번거리고 있다. 다행이다.',
      },
      {
        text: '"교복 좋은데?" — 거울을 본다',
        effects: { mental: 3, social: 1 },
        message: '교복을 입으니 뭔가 어른이 된 기분. 나쁘지 않다.',
      },
    ],
  },
  ...DOYUN_SCHOOL_SPLIT,
  // ===== 중2 개학 (Y3 W1) =====
  {
    id: 'middle2-start',
    title: '중2, 시작',
    description: '2학년이 됐다. 이제 이 학교에 완전히 익숙하다.\n후배가 생겼다. 복도에서 마주치면 인사하는 게 좀 어색하면서도 뿌듯하다.\n교실 창밖으로 벚꽃이 보인다.',
    week: 1,
    condition: (s) => s.year === 3,
    location: 'classroom',
    background: 'classroom_{school}_spring',
    choices: [
      {
        text: '"올해는 좀 더 열심히 해볼까" — 다짐한다',
        effects: { academic: 1, mental: 3 },
        message: '새 학기 결심은 항상 좋다. 얼마나 갈지는 모르지만.',
      },
      {
        text: '"이제 좀 여유롭네" — 편안하게 시작한다',
        effects: { mental: 4, social: 1 },
        message: '작년에 비하면 훨씬 편하다. 친구도 있고, 학교도 익숙하고.',
      },
    ],
  },
  // ===== 중3 개학 (Y4 W1) =====
  {
    id: 'middle3-start',
    title: '중3, 마지막 해',
    description: '중학교 마지막 해다. 선생님이 첫날부터 말씀하신다.\n"올해는 고등학교 진학이 있으니까 정신 차려야 해."\n교실 분위기가 작년과 좀 다르다. 다들 뭔가 진지해졌다.',
    week: 1,
    condition: (s) => s.year === 4,
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      {
        text: '"고등학교..." — 진지하게 생각해본다',
        effects: { academic: 2, mental: 1 },
        message: '아직 실감이 안 나지만, 뭔가 준비해야 한다는 건 안다.',
      },
      {
        text: '"아직 1년이나 남았는데 뭘" — 여유를 부린다',
        effects: { mental: 3, social: 1 },
        message: '1년이면 긴 거지. 일단 오늘은 친구들이랑 놀자.',
      },
      {
        text: '"특목고 가려면..." — 목표를 세운다',
        effects: { academic: 3, mental: -1 },
        message: '벌써부터 부담이 느껴진다. 하지만 목표가 생기니 뭔가 달라진 느낌.',
      },
    ],
  },
  // ===== 중학교 졸업 (Y4 W46) =====
  {
    id: 'middle-school-graduation',
    title: '중학교 졸업식',
    description: '졸업장을 받았다. 3년이 이렇게 빨리 갈 줄 몰랐다.\n교실에서 친구들과 마지막 시간을 보내고 있다.\n누군가가 "우리 고등학교 가서도 만나자" 했다.\n정말 만날 수 있을까?',
    week: 46,
    condition: (s) => s.year === 4,
    location: 'auditorium',
    background: 'auditorium_middle',
    speakers: ['jihun', 'subin', 'minjae', 'yuna'],
    choices: [
      {
        text: '친구들과 마지막 사진을 찍는다',
        effects: { social: 4, mental: 3 },
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 1 },
          { npcId: 'subin', intimacyChange: 1 },
          { npcId: 'minjae', intimacyChange: 1 },
          { npcId: 'yuna', intimacyChange: 1 },
        ],
        message: '단체 사진을 찍었다. 다들 웃고 있지만 눈이 좀 빨갛다. 이 순간을 잊지 말자.',
      },
      {
        text: '교실에서 혼자 시간을 보낸다',
        effects: { mental: 5 },
        message: '빈 교실에서 3년을 돌아봤다. 후회도, 감사도, 그리움도. 전부 내 중학교 시절이다.',
      },
      {
        text: '"고등학교에서 더 잘하면 되지!" — 앞을 본다',
        effects: { mental: 3, academic: 1 },
        message: '졸업은 끝이 아니라 시작이다. 다음 3년이 기대된다.',
      },
    ],
  },
  // ===== 고등학교 입학 (Y5 W1) =====
  {
    id: 'high-school-entrance',
    title: '고등학교 입학식',
    description: '고등학생이 됐다.\n교문 앞에서 한 번 멈춘다. 여기서 3년을 보내게 되는 거다.\n새 교복, 새 학교, 새 교실. 모든 게 처음부터 다시.\n"수능까지 3년..." 누군가가 중얼거렸다.\n\n...본격적인 시작이다.',
    week: 1,
    condition: (s) => s.year === 5,
    location: 'auditorium',
    background: 'school_gate_high',
    speakers: ['jihun'],
    choices: [
      {
        text: '새로운 친구에게 말을 건다',
        effects: { social: 3, mental: 3 },
        message: '"반가워! 나도 처음이라 떨려." 새 환경이지만, 사람 사이는 어디나 비슷하다.',
      },
      {
        text: '"3년 안에 최선을 다하자" — 각오를 다진다',
        effects: { academic: 2, mental: 2 },
        message: '고등학교. 여기서의 3년이 인생을 바꿀 수도 있다. 긴장되지만 해볼 만하다.',
      },
      {
        text: '중학교 친구에게 연락한다',
        effects: { mental: 4, social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '"야, 고등학교 어때?" 지훈이가 물었다. "아직 모르겠어. 근데 좀 무섭다." "...나도."',
      },
    ],
  },
  // ===== 고2 개학 + 문이과 선택 (Y6 W1) =====
  {
    id: 'high2-track-select',
    title: '고2, 문·이과를 고르다',
    description: '고2가 됐다. 담임이 종이 한 장을 나눠준다.\n"이번 주까지 문·이과 결정해서 내. 나중에 바꾸기 어려워."\n\n주변 애들이 웅성거린다.\n"나 그냥 이과 갈래, 취업 잘 된다잖아."\n"난 수학 못 해서 문과..."\n\n한 번 정하면 돌이킬 수 없는 선택이다.',
    week: 1,
    condition: (s) => s.year === 6 && s.track === null,
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      {
        text: '문과 — 사람과 사회를 공부하고 싶다',
        effects: { social: 2, mental: -1 },
        trackSelect: 'humanities',
        message: '문과로 결정했다. 국어·영어·사회탐구가 주 과목이다.\n법, 경영, 언론, 교육... 길은 많다.',
      },
      {
        text: '이과 — 수학·과학이 더 적성에 맞는다',
        effects: { talent: 2, mental: -1 },
        trackSelect: 'science',
        message: '이과로 결정했다. 수학·과학탐구가 주 과목이다.\n의대, 공대, 자연과학... 길은 많지만 수학이 관건이다.',
      },
    ],
  },
  // ===== 고3 개학 (Y7 W1) =====
  {
    id: 'high3-start',
    title: '고3, 마지막 시작',
    description: '마지막 학년이다.\n교실에 들어서는데 분위기가 무겁다. 칠판 위에 "D-xxx" 카운트다운이 적혀 있다.\n12년의 학교생활이 이 한 해로 끝난다.\n\n...복잡한 감정이 든다.',
    week: 1,
    condition: (s) => s.year === 7,
    location: 'classroom',
    background: 'classroom_{school}',
    speakers: ['jihun'],
    choices: [
      {
        text: '"후회 없이 보내자" — 담담하게 시작한다',
        effects: { mental: 5, academic: 1 },
        message: '긴장되지만, 지금까지 해온 게 있다. 내가 걸어온 길을 믿자.',
      },
      {
        text: '"...무섭다" — 솔직하게 느낀다',
        effects: { mental: 2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '"나도 무서워." 지훈이가 옆에서 말했다. "근데 같이 하면 괜찮을 거야."',
      },
      {
        text: '"어차피 할 건 해야지" — 이를 악문다',
        effects: { academic: 3, mental: -2 },
        message: '감정은 사치다. 일단 공부. 하지만... 이 속도로 1년을 버틸 수 있을까.',
      },
    ],
  },
  {
    id: 'jihun-call',
    title: '지훈이의 전화',
    // 남자 버전: 농구
    description: '저녁에 지훈이한테 전화가 왔다.\n"야, 이번 주말에 농구하러 갈래? 민재도 온대."',
    week: 4,
    location: 'home',
    background: 'home_evening',
    speakers: ['jihun', 'minjae'],
    choices: [
      {
        text: '"가자!" — 주말에 농구하러 간다',
        effects: { health: 2, social: 2, mental: 3 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }, { npcId: 'minjae', intimacyChange: 1 }],
        message: '지훈이, 민재와 농구를 했다. 오랜만에 신나게 뛰었다!',
        timeCost: 1,
      },
      {
        text: '"미안, 공부해야 해..." — 거절한다',
        effects: { academic: 1, mental: -2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -3 }],
        message: '지훈이가 "알겠어..."라고 했다. 전화를 끊고 나니 좀 찝찝하다.',
      },
    ],
    // 여자 버전: 떡볶이
    femaleDescription: '저녁에 지훈이한테 전화가 왔다.\n"야, 너 요즘 공부만 하잖아. 이번 주말에 떡볶이 먹으러 갈래? 민재도 온대."',
    femaleChoices: [
      {
        text: '"가자!" — 같이 떡볶이 먹으러 간다',
        effects: { social: 3, mental: 4 },
        fatigueEffect: 1,
        moneyEffect: -1,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }, { npcId: 'minjae', intimacyChange: 1 }],
        message: '지훈이, 민재와 분식집에서 떡볶이를 먹었다. 수다 떨다 보니 시간 가는 줄 몰랐다!',
        timeCost: 1,
      },
      {
        text: '"미안, 공부해야 해..." — 거절한다',
        effects: { academic: 1, mental: -2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -3 }],
        message: '지훈이가 "알겠어..."라고 했다. 전화를 끊고 나니 좀 찝찝하다.',
      },
    ],
  },
  // ===== 1학기 이벤트 =====
  // ===== 초등 봄 소풍 (Y1 W5) — 4월 말 =====
  {
    id: 'elementary-spring-picnic',
    title: '봄 소풍',
    description: '오늘은 봄 소풍 날. 김밥 도시락에 간식까지 든 가방이 묵직하다.\n공원에 도착하니 벚꽃잎이 바람에 흩날린다.\n민재가 손을 흔든다. "야 너도 여기 앉아!"\n한쪽에서는 선생님이 장기자랑 신청을 받고 있다.',
    week: 5,
    condition: (s) => s.year === 1,
    location: 'park',
    background: 'park_spring',
    speakers: ['minjae', 'jihun'],
    choices: [
      {
        text: '친구들이랑 같이 먹는다',
        effects: { social: 3, mental: 3 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }, { npcId: 'jihun', intimacyChange: 1 }],
        message: '김밥 나눠 먹으면서 웃고 떠들었다. 이런 게 학교 다니는 맛이지.',
      },
      {
        text: '장기자랑에 나간다',
        effects: { social: 4, talent: 2, mental: 2 },
        message: '얼떨결에 무대에 올라갔다. 얼굴이 빨개졌지만, 박수 소리가 좋았다.',
      },
      {
        text: '혼자 조용히 주변을 구경한다',
        effects: { mental: 3, health: 1 },
        message: '벚꽃이 바람에 흩날린다. 혼자 있는 시간도 나쁘지 않다.',
      },
    ],
  },
  // ===== 초등 2학기 시작 (Y1 W25) — 여름방학 끝, 9월 초 =====
  {
    id: 'elementary-semester2-start',
    title: '2학기 시작',
    description: '여름방학이 끝나고 2학기가 시작됐다.\n반 애들이 햇빛에 탄 얼굴로 돌아왔다.\n칠판에는 "곧 졸업이다!" 라고 선생님이 큰 글씨로 써놓았다.\n벌써 마지막 학기라니.',
    week: 25,
    condition: (s) => s.year === 1,
    location: 'classroom',
    background: 'classroom_elementary_afternoon',
    choices: [
      {
        text: '"중학교 가기 전에 더 열심히 해야지"',
        effects: { academic: 2, mental: -1 },
        message: '마지막 학기. 중학교 진학 준비를 조금씩 시작하기로 했다.',
      },
      {
        text: '"일단 방학 얘기부터 풀자!" — 친구들과 수다',
        effects: { social: 3, mental: 3 },
        message: '방학 동안 있었던 얘기로 한참을 떠들었다. 다들 할 얘기가 많다.',
      },
      {
        text: '"졸업 전에 좋은 추억 많이 남겨야지"',
        effects: { mental: 3, social: 1 },
        message: '이 교실에 있을 시간도 얼마 안 남았다는 게 새삼 실감난다.',
      },
    ],
  },
  // ===== 초등 가을 운동회 (Y1 W32) — 10월 =====
  {
    id: 'elementary-sports-day',
    title: '가을 운동회',
    description: '가을 운동회다. 선선한 바람에 깃발이 펄럭이고, 청팀·백팀 응원 소리가 운동장을 가득 메운다.\n이어달리기 순서가 돌아왔다.\n지훈이가 바통을 건넨다. "야, 우리 청팀이 이길 수 있어!"',
    week: 32,
    condition: (s) => s.year === 1,
    location: 'gym',
    background: 'gymnasium',
    speakers: ['jihun'],
    choices: [
      {
        text: '있는 힘껏 달린다',
        effects: { health: 3, social: 2, mental: 2 },
        fatigueEffect: 8,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 2 }],
        message: '바람이 귀를 스친다. 결과는 2등. 지훈이가 "수고했다!" 하며 어깨를 감쌌다.',
      },
      {
        text: '무리 안 하고 페이스 유지한다',
        effects: { health: 1, mental: 1 },
        fatigueEffect: 3,
        message: '적당히 뛰었다. 순위는 중간쯤. 그래도 즐거웠다.',
      },
    ],
  },
  // 초등 단원평가 이벤트 (Y1, W16 — 단원평가 W17 전주)
  {
    id: 'elementary-unit-test',
    title: '단원평가가 다가온다',
    description: '선생님이 "다음 주에 단원평가 볼 거야~" 하고 말했다.\n주변 친구들은 별로 신경 안 쓰는 눈치다.',
    week: 16,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s) => s.year === 1,
    choices: [
      {
        text: '집에 가서 복습한다',
        effects: { academic: 2, mental: -1 },
        message: '교과서를 펴고 복습했다. 내용이 좀 기억난다.',
      },
      {
        text: '그냥 평소대로 논다',
        effects: { mental: 1 },
        message: '시험이라고 해도 별로 긴장은 안 된다. 어차피 단원평가잖아.',
      },
    ],
  },
  // 중등/고등 중간고사 이벤트 (W7 — 중간고사 W8 전주)
  {
    id: 'midterm-1',
    title: '첫 중간고사',
    description: '중간고사가 다가온다. 교실 분위기가 달라졌다.\n다들 쉬는 시간에도 책을 펴고 있다.',
    week: 7,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s) => s.year >= 2,
    choices: [
      {
        text: '시험공부에 올인한다 — 이번만큼은 잘 보고 싶다',
        effects: { academic: 4, mental: -3 },
        fatigueEffect: 10,
        message: '시험공부에 매달렸다. 피곤하지만 뭔가 뿌듯하다.',
      },
      {
        text: '평소대로 한다 — 벼락치기는 안 맞아',
        effects: { academic: 1, mental: 1 },
        message: '무리하지 않고 평소 페이스를 유지했다.',
      },
      {
        text: '친구들이랑 같이 공부한다 — 혼자는 지루해',
        effects: { academic: 2, social: 2 },
        fatigueEffect: 5,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 3 }],
        message: '유나랑 같이 공부했다. 유나가 모르는 거 잘 알려준다.',
      },
    ],
  },
  // 고등 모의고사 이벤트 (W11 — 모의 W12 전주)
  {
    id: 'mock-exam-prep',
    title: '모의고사가 다가온다',
    description: '다음 주에 전국 모의고사다.\n선생님이 "이번 모의는 수능 출제 방식이랑 똑같아" 하고 말한다.\n...긴장된다.',
    week: 11,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s) => s.year >= 5,
    choices: [
      {
        text: '기출문제를 풀며 감을 잡는다',
        effects: { academic: 3, mental: -2 },
        fatigueEffect: 8,
        message: '기출문제를 풀었다. 실전 감각이 좀 살아나는 느낌이다.',
      },
      {
        text: '컨디션 관리에 집중한다',
        effects: { mental: 2, health: 1 },
        message: '무리하지 않고 컨디션을 맞췄다. 머리가 맑다.',
      },
      {
        text: '모의는 모의일 뿐 — 크게 신경 안 쓴다',
        effects: { mental: 1 },
        message: '별로 긴장하지 않았다. 어차피 모의고사잖아.',
      },
    ],
  },
  {
    id: 'subin-academy',
    title: '수빈이와 학원',
    description: '학원 복도에서 수빈이가 다른 반 아이들과 웃으며 얘기하고 있다.\n나를 발견하자 "야, 너도 김쌤 반이야? 김쌤 숙제 진짜 많지 않아? 쉬는 시간에 편의점 가자~"',
    week: 5,
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && (s.routineSlot2 === 'academy' || s.routineSlot3 === 'academy');
    },
    location: 'street',
    background: 'hagwon_front',
    speakers: ['subin'],
    choices: [
      {
        text: '"그래!" — 같이 간다',
        effects: { social: 1, mental: 2 },
        moneyEffect: -1,
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '수빈이랑 편의점에서 아이스크림을 먹었다. 수빈이는 벌써 편의점 누나랑도 친해져 있었다. 이 애는 어디서든 금방 친해진다.',
      },
      {
        text: '"나 복습 좀 해야 해" — 거절한다',
        effects: { academic: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: -2 }],
        message: '"아 그래? 알겠어~" 수빈이가 금방 다른 아이를 데리고 갔다. 아쉬울 틈도 없다.',
      },
    ],
  },
  {
    id: 'sports-day',
    title: '체육대회',
    description: '학교 체육대회 날이다! 반 대항 릴레이가 있다.\n"야, 너 달리기 잘해? 우리 반 대표 한 명 더 필요한데..."',
    week: 10,
    location: 'gym',
    background: 'gymnasium',
    choices: [
      {
        text: '"내가 할게!" — 대표로 나선다',
        effects: { social: 4, health: 2, mental: 3 },
        fatigueEffect: 5,
        message: '반 대표로 달렸다! 1등은 아니었지만 다들 고마워했다. 이름을 기억하는 아이가 늘었다.',
        timeCost: 1,
      },
      {
        text: '"나는 패스..." — 응원만 한다',
        effects: { social: 1, mental: 1 },
        message: '응원석에서 소리 질렀다. 재밌긴 한데, 좀 아쉽다.',
      },
      {
        text: '체육대회를 핑계로 쉰다 — 보건실에 간다',
        effects: { health: 1 },
        fatigueEffect: -5,
        message: '보건실에서 쉬면서 소리만 들었다. 편하긴 한데...',
      },
    ],
  },
  // ===== 여름방학 이벤트 =====
  {
    id: 'summer-start',
    title: '여름방학 시작!',
    description: '드디어 방학이다! 종업식이 끝나고 교문을 나서는 순간, 자유의 공기가 느껴진다.\n이번 방학, 뭘 하고 싶어?',
    week: 20,
    location: 'school_gate',
    background: 'school_gate_{school}',
    choices: [
      {
        text: '"이번 방학엔 진짜 공부 열심히 할 거야"',
        effects: { academic: 2, mental: -1 },
        message: '의지를 다졌다. 과연 지킬 수 있을까?',
      },
      {
        text: '"실컷 놀 거야!!!"',
        effects: { mental: 5, social: 2 },
        message: '해방감이 밀려온다. 이게 방학이지!',
      },
      {
        text: '"돈 좀 모아야겠다"',
        effects: {},
        moneyEffect: 3,
        message: '용돈 벌 방법을 찾아봤다. 뭐라도 해봐야지.',
      },
    ],
  },
  {
    id: 'summer-trip',
    title: '지훈이의 제안',
    description: '"야, 이번에 바다 갈래? 민재도 간대.\n수빈이한테도 물어볼까?"',
    background: 'beach_summer',
    week: 22,
    location: 'beach',
    speakers: ['jihun', 'minjae', 'subin'],
    choices: [
      {
        text: '"가자!!!" — 다 같이 바다로!',
        effects: { social: 3, health: 2, mental: 5 },
        fatigueEffect: 3,
        moneyEffect: -3,
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 6 },
          { npcId: 'minjae', intimacyChange: 3 },
          { npcId: 'subin', intimacyChange: 3 },
        ],
        message: '바다에서 하루를 보냈다. 지훈이가 수박을 사왔고, 민재는 모래성을 만들다 무너뜨렸다. 최고의 하루.',
        timeCost: 2,
      },
      {
        text: '"나 학원 있어서..." — 못 간다',
        effects: { academic: 2, mental: -3 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -5 }],
        message: '학원에 앉아있는데 SNS에 바다 사진이 올라왔다. ... 집중이 안 된다.',
      },
    ],
  },
  // ===== 2학기 이벤트 =====
  {
    id: 'school-festival',
    title: '학교 축제',
    description: '축제 준비가 한창이다. 우리 반은 푸드트럭을 하기로 했다.\n수빈이가 "야, 홍보는 내가 할게! 누가 같이 하자~" 하며 손을 든다.',
    week: 30,
    condition: (s) => s.year >= 2,
    location: 'classroom',
    background: 'festival_classroom',
    speakers: ['subin'],
    choices: [
      {
        text: '"나도 할게!" — 수빈이랑 홍보 담당',
        effects: { social: 4, talent: 3, mental: 2 },
        fatigueEffect: 5,
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '수빈이랑 같이 포스터를 만들었다. 수빈이가 옆 반 애들까지 불러와서 반응이 폭발! "너네 반 축제 진짜 기대된다!"',
        memorySlotDraft: {
          category: 'courage',
          importance: 5,
          toneTag: 'resolve',
          recallText: '축제 전날 복도에서 포스터 붙이다 수빈이와 맞잡은 눈짓.',
          npcIds: ['subin'],
        },
      },
      {
        text: '"회계 할게" — 뒤에서 조용히',
        effects: { academic: 1, social: 1 },
        message: '회계를 맡았다. 수빈이가 SNS에 올리고 옆 반까지 다 돌려서... 줄이 길어졌다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '축제 회계 장부 한 귀퉁이에 그날 매출을 적어둔 내 글씨.',
        },
      },
      {
        text: '"나 몸이 안 좋아서..." — 축제에 참여 안 한다',
        effects: { social: -3, mental: -2 },
        fatigueEffect: -5,
        message: '집에서 쉬었다. 단톡방에 축제 사진이 올라온다. ... 괜히 빠진 것 같다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 5,
          toneTag: 'regret',
          recallText: '축제 사진이 단톡방에 올라오던 밤, 천장만 보고 있었다.',
        },
      },
    ],
  },
  {
    id: 'yuna-study',
    title: '유나의 부탁',
    description: '유나가 씩 웃으며 다가온다.\n"야, 나 수학 7번 도저히 모르겠거든? 너 잘하잖아, 좀 알려줘!"',
    week: 34,
    condition: (s) => s.stats.academic >= 50 && s.year !== 7, // Y7 W34는 수능 전날
    location: 'library',
    background: 'library_{school}',
    speakers: ['yuna'],
    choices: [
      {
        text: '"그래, 같이 하자" — 가르쳐준다',
        effects: { academic: 1, social: 2, mental: 2 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 8 }],
        message: '유나에게 수학을 가르쳤다. 가르치면서 나도 더 잘 이해하게 됐다. 유나가 "오 대박, 이거였어? 천재 아냐?" 했다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 5,
          toneTag: 'warm',
          recallText: '도서관 책상 위 유나의 "천재 아냐?" — 웃는 목소리가 이상하게 오래 남았다.',
          npcIds: ['yuna'],
        },
      },
      {
        text: '"미안, 나도 바빠서..." — 거절한다',
        effects: { academic: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: -5 }],
        message: '유나가 "아 그래? 알겠어~" 하며 돌아갔다. 웃고 있는데 좀 아쉬워 보였다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 5,
          toneTag: 'regret',
          recallText: '"괜찮아~" 하고 돌아서던 유나의 뒷모습이 너무 가볍게 느껴졌다.',
          npcIds: ['yuna'],
        },
      },
    ],
  },
  // 초등 2학기 단원평가 이벤트 (Y1, W37 — 단원평가 W38 전주)
  {
    id: 'elementary-unit-test-2',
    title: '2학기 단원평가가 다가온다',
    description: '선생님이 "다음 주에 2학기 단원평가 볼 거야~ 올해 마지막이니까 잘 해보자!" 하고 웃는다.\n주변 친구들도 이번엔 조금은 긴장하는 눈치다.',
    week: 37,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s) => s.year === 1,
    choices: [
      {
        text: '열심히 복습한다 — 마지막이니까!',
        effects: { academic: 2, mental: -1 },
        message: '열심히 복습했다. 올해 배운 게 꽤 많았구나.',
      },
      {
        text: '대충 본다 — 곧 졸업이잖아',
        effects: { mental: 1 },
        message: '시험보다는 졸업식이 더 기대된다.',
      },
    ],
  },
  // 중등/고등 기말고사 이벤트 (W37 — 기말 W38 전주)
  {
    id: 'final-exam-2',
    title: '기말고사',
    description: '2학기 기말고사. 올해의 마지막 시험이다.\n이번 성적이 통지표에 그대로 간다.',
    week: 37,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s) => s.year >= 2,
    choices: [
      {
        text: '이번엔 진짜 최선을 다한다',
        effects: { academic: 5, mental: -4 },
        fatigueEffect: 12,
        message: '있는 힘을 다해 시험을 봤다. 끝나고 나니 머리가 텅 비었다.',
      },
      {
        text: '적당히 한다 — 건강이 먼저야',
        effects: { academic: 2, mental: 1 },
        fatigueEffect: 3,
        message: '무리하지 않았다. 결과가 어떻든 후회는 없다.',
      },
    ],
  },
  // 고등 2학기 모의고사 이벤트 (W32 — 모의 W33 전주)
  {
    id: 'mock-exam-prep-2',
    title: '9월 모의고사',
    description: '9월 모의고사가 다가온다.\n"이번 모의 성적이 수시 지원 기준이야" — 선생님의 말에 교실이 조용해졌다.',
    week: 32,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s) => s.year >= 5,
    choices: [
      {
        text: '이번엔 제대로 준비한다',
        effects: { academic: 4, mental: -3 },
        fatigueEffect: 10,
        message: '밤늦게까지 공부했다. 이번엔 좀 다른 결과가 나올까.',
      },
      {
        text: '평소 실력대로 본다',
        effects: { mental: 1 },
        message: '있는 그대로 보기로 했다. 그게 진짜 실력이니까.',
      },
    ],
  },
  // ===== 겨울방학 이벤트 =====
  {
    id: 'winter-start',
    title: '겨울방학',
    description: '겨울방학이 시작됐다. 크리스마스가 다가오고, 거리에 캐롤이 흘러나온다.\n올해도 끝나간다.',
    week: 43,
    location: 'home',
    background: 'school_road_morning',
    speakers: ['jihun', 'subin'],
    choices: [
      {
        text: '크리스마스에 친구들과 모인다',
        effects: { social: 3, mental: 4 },
        moneyEffect: -2,
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 3 },
          { npcId: 'subin', intimacyChange: 1 },
        ],
        message: '친구들과 선물을 교환하고 케이크를 먹었다. 따뜻한 하루.',
      },
      {
        text: '집에서 가족과 보낸다',
        effects: { mental: 3 },
        message: '가족과 조용히 보냈다. 엄마가 치킨을 시켜줬다.',
      },
      {
        text: '알바한다 — 돈이 필요해',
        effects: { mental: -1 },
        moneyEffect: 5,
        message: '크리스마스에도 일했다. 돈은 벌었는데... 좀 씁쓸하다.',
        condition: (s) => s.year >= 4,
      },
      {
        text: '엄마 심부름 — 용돈 받기',
        effects: { mental: 1 },
        moneyEffect: 1,
        message: '엄마 부탁으로 마트 심부름. 거스름돈에서 천 원짜리 한 장을 슬쩍 챙겼다. 작은 용돈이지만 기분이 좋다.',
        condition: (s) => s.year < 4,
      },
    ],
  },
  {
    id: 'year-end-reflection',
    title: '새해 전날',
    description: '12월 31일 밤. 올 한 해를 돌아본다.\n창밖으로 불꽃놀이 소리가 들린다.',
    week: 47,
    condition: (s) => s.year !== 1 && s.year !== 4 && s.year !== 7, // 졸업 해에는 졸업 이벤트가 W46에 뜸
    location: 'home',
    background: 'night_sky_fireworks',
    choices: [
      {
        text: '"내년에는 더 잘할 거야" — 다짐한다',
        effects: { mental: 3 },
        message: '"내년에는..." 다짐을 적었다. 지킬 수 있을까. 그래도 적는 것만으로 기분이 좋다.',
      },
      {
        text: '"올해도 나쁘지 않았어" — 만족한다',
        effects: { mental: 5 },
        message: '올해를 돌아보니, 생각보다 많은 일이 있었다. 나쁘지 않았어.',
      },
    ],
  },
  // ===== 고3 수능 이벤트 =====
  {
    id: 'suneung-eve',
    title: '수능 전날',
    description: '내일이 수능이다.\n방에 앉아 있는데 아무것도 손에 잡히지 않는다.\n12년을 달려온 끝이 내일이라니.\n엄마가 방문을 열고 들어오셨다. "...잘 할 수 있어."',
    week: 34,
    condition: (s) => s.year === 7,
    location: 'home',
    background: 'bedroom_night',
    choices: [
      {
        text: '일찍 잠자리에 든다',
        effects: { mental: 3 },
        fatigueEffect: -10,
        message: '이불을 덮었는데 잠이 안 온다. 천장만 바라보다가 어느새 잠들었다.',
      },
      {
        text: '마지막으로 오답 노트를 펼친다',
        effects: { academic: 2, mental: -1 },
        message: '손에 잡히지 않지만 한 장씩 넘겼다. 이 정도면... 됐다.',
      },
      {
        text: '친구에게 연락한다',
        effects: { mental: 5, social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '"야, 긴장돼?" "응. 미치겠어." "...내일 끝나고 치킨 먹자." "...그래."',
      },
    ],
  },
  {
    id: 'suneung-done',
    title: '수능이 끝났다',
    description: '시험장을 나온다. 하늘이 유난히 맑다.\n12년의 공부가 끝났다. 주변에서 우는 애도, 웃는 애도, 멍하니 서 있는 애도 있다.\n\n...끝났다. 정말로.',
    week: 36,
    condition: (s) => s.year === 7,
    location: 'street',
    background: 'clear_sky',
    speakers: ['jihun', 'minjae'],
    choices: [
      {
        text: '친구들과 치킨을 먹으러 간다',
        effects: { social: 4, mental: 5 },
        moneyEffect: -2,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }, { npcId: 'minjae', intimacyChange: 1 }],
        message: '"야, 우리 해냈다!" 치킨이 이렇게 맛있었던 적이 있었나. 다 같이 웃고 울었다.',
        timeCost: 1,
      },
      {
        text: '혼자 걸어서 집에 간다',
        effects: { mental: 4 },
        message: '천천히 걸었다. 벚꽃이 질 때 시작해서, 낙엽이 질 때 끝났다. 긴 여정이었다.',
      },
      {
        text: '바로 성적 채점을 해본다',
        effects: { academic: 1, mental: -3 },
        message: '채점 결과가... 어떻게 됐든, 이미 끝난 거다. 결과는 12월에 나온다.',
      },
    ],
  },
  // ===== 고등학교 졸업 (Y7 W46) =====
  {
    id: 'high-school-graduation',
    title: '졸업',
    description: '졸업식 날이다.\n12년간의 학교생활이 오늘로 끝난다.\n\n강당에서 졸업장을 받고, 교실로 돌아왔다.\n칠판에 누군가가 적어놨다.\n\n"졸업 축하해. 우리 모두 수고했어."',
    week: 46,
    condition: (s) => s.year === 7,
    location: 'auditorium',
    background: 'auditorium_high',
    speakers: ['jihun', 'subin', 'minjae', 'yuna', 'junha'],
    choices: [
      {
        text: '친구들과 마지막 인사를 나눈다',
        effects: { social: 5, mental: 5 },
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 3 },
          { npcId: 'subin', intimacyChange: 3 },
          { npcId: 'minjae', intimacyChange: 3 },
          { npcId: 'yuna', intimacyChange: 3 },
          { npcId: 'junha', intimacyChange: 3 },
        ],
        message: '서로 안아주고, 사진 찍고, 연락처를 확인했다. "꼭 다시 만나자." 눈물이 났다.',
      },
      {
        text: '빈 교실에서 혼자만의 시간을 보낸다',
        effects: { mental: 7 },
        message: '창밖을 바라봤다. 이 교실에서 웃고, 울고, 싸우고, 화해했다. 전부 내 청춘이었다.',
      },
      {
        text: '교문을 나서며 뒤를 돌아보지 않는다',
        effects: { mental: 3, academic: 1 },
        message: '앞만 보고 걸었다. 이제부터가 진짜 시작이다.',
      },
    ],
  },
  ...HAEUN_EVENTS,
  ...JIHUN_EVENTS,
  ...SUBIN_EVENTS,
  ...MINJAE_EVENTS,
  ...YUNA_EVENTS,
  // ===== 반장 후속 이벤트 =====
  {
    id: 'class-president-nudge', title: '민재의 추천',
    description: '쉬는 시간에 민재가 다가온다.\n"야, 부반장 자리 아직 비었는데, 너가 하면 딱인데? 내가 추천할까?"',
    location: 'classroom',
    background: 'classroom_{school}',
    speakers: ['minjae'],
    choices: [
      { text: '"...해볼까?" — 민재 말에 용기를 낸다', effects: { social: 4, mental: 2 }, fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '부반장이 됐다! 민재가 "내 눈은 틀리지 않지" 하며 웃었다.' },
      { text: '"아니야, 난 괜찮아" — 정중하게 거절한다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '"알겠어, 근데 너 진짜 잘할 수 있었을 텐데." 민재 말에 기분이 나쁘진 않았다.' },
    ],
    condition: (s) => {
      const electionEvent = s.events.find(e =>
        (e.id === 'class-president' || e.id === 'class-president-2') &&
        e.year === s.year &&
        e.resolvedChoice === 1 &&
        s.week - (e.week || 0) <= 4
      );
      const alreadyFiredThisYear = s.events.some(e => e.id === 'class-president-nudge' && e.year === s.year);
      return !!electionEvent && !alreadyFiredThisYear && s.stats.social >= 55;
    },
  },
  // ===== 랜덤 이벤트 (조건부) =====
  {
    id: 'fatigue-warning',
    title: '몸이 무겁다',
    description: '아침에 일어나기가 힘들다. 몸이 천근만근이다.\n"오늘 학교 가기 싫다..."',
    condition: (s) => s.fatigue >= 60 && s.week > 5,
    location: 'home',
    background: 'bedroom_night',
    choices: [
      {
        text: '그래도 간다 — 빠지면 뒤처져',
        effects: { academic: 1, mental: -2 },
        fatigueEffect: 3,
        message: '억지로 학교에 갔다. 수업 내내 졸았다.',
      },
      {
        text: '하루 쉰다 — 오늘은 못 가겠어',
        effects: { mental: 2 },
        fatigueEffect: -10,
        message: '하루 푹 쉬었다. 몸은 좀 나아졌는데, 결석 1일.',
      },
    ],
  },
  {
    id: 'mental-low',
    title: '혼자인 점심시간',
    description: '점심시간. 친구들이 다 어디 갔는지 주변에 아무도 없다.\n혼자 밥을 먹으며 핸드폰을 본다.',
    condition: (s) => s.stats.social < 30 && s.week > 8,
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    // speakers 제거 — description에는 아직 아무도 등장하지 않음 (choices에서만 등장)
    choices: [
      {
        text: '괜찮아, 혼자가 편해',
        effects: { mental: 1 },
        message: '혼자만의 시간도 나쁘지 않다. ... 정말?',
      },
      {
        text: '같은 반 아이에게 말을 걸어본다',
        effects: { social: 3, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '"같이 먹어도 돼?" "어, 그래!" 용기를 냈더니 생각보다 쉬웠다.',
      },
    ],
  },
  // v1.2 하드 위기: 중2 번아웃 (Y3 전용, 부록 D.1)
  // getEventForWeek가 state.hardCrisisYears 가드로 연간 1회 상한 강제
  {
    id: 'middle-burnout',
    title: '중2의 긴 겨울',
    description: '책상 앞에 앉아도 펜만 굴러다닌다.\n어제랑 오늘이 구분이 안 간다.\n엄마가 뭐라고 했는데 반쪽은 흘려들었다.\n"나 괜찮은 걸까..."',
    // M5 Phase 2: mental 40 → 55, idleWeeks 4 → 3 완화. Y3 1회 가드(hardCrisisYears)로
    // 과잉 발동 방지. burnout-event(year !== 3 가드)와 충돌 없음.
    condition: (s) => s.year === 3 && s.idleWeeks >= 3 && s.stats.mental <= 55,
    location: 'home',
    background: 'bedroom_night',
    choices: [
      {
        text: '그래도 억지로 공부한다',
        effects: { academic: 1, mental: -4 },
        fatigueEffect: 5,
        message: '책은 펼쳐 놨지만 글자가 안 읽힌다. 저녁이 지나가고 커피만 식었다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 7,
          toneTag: 'regret',
          recallText: '책상 위 커피 얼룩만 늘어가던, 중2의 긴 겨울.',
        },
      },
      {
        text: '오늘은 아무것도 안 한다 — 쉰다',
        effects: { mental: 4 },
        fatigueEffect: -15,
        message: '책상 정리하고 이불 안으로 들어갔다. 죄책감보다 숨이 먼저 돌아왔다.',
        memorySlotDraft: {
          category: 'growth',
          importance: 8,
          toneTag: 'breakthrough',
          recallText: '아무것도 안 한 날. 죄책감보다 숨이 먼저 돌아왔다.',
        },
      },
      {
        text: '지훈이에게 전화한다 — 힘들다고 말한다',
        effects: { mental: 6, social: 2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 4 }],
        message: '"...힘들어." 지훈이가 오래 들어줬다. 뭐라고 조언해준 건 아닌데, 그게 더 좋았다.',
        memorySlotDraft: {
          category: 'growth',
          importance: 8,
          toneTag: 'warm',
          recallText: '힘들다고 말했더니, 지훈이는 그냥 들어줬다.',
          npcIds: ['jihun'],
        },
      },
    ],
  },
  {
    id: 'burnout-event',
    title: '한계',
    description: '아무것도 하고 싶지 않다. 책상 앞에 앉아도 글자가 안 읽힌다.\n창밖만 멍하니 바라본다.',
    condition: (s) => s.mentalState === 'burnout' && s.year !== 3,  // v1.2: Y3는 middle-burnout이 선점
    location: 'home',
    background: 'bedroom_night',
    // speakers 제거 — 집에서 혼자인 장면. 지훈은 choices[2]에서만 등장
    choices: [
      {
        text: '그래도 억지로 공부한다',
        effects: { academic: 1, mental: -5 },
        fatigueEffect: 5,
        message: '억지로 했지만 아무것도 머리에 안 들어온다. 더 지쳤다.',
      },
      {
        text: '오늘은 그냥 쉰다',
        effects: { mental: 3 },
        fatigueEffect: -8,
        message: '아무것도 안 했다. 죄책감이 들지만... 지금은 쉬는 게 맞다.',
      },
      {
        text: '지훈이에게 전화한다',
        effects: { mental: 5, social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }],
        message: '"야, 나 요즘 좀 힘들어..." 지훈이가 아무 말 없이 들어줬다. 좀 나아졌다.',
      },
    ],
  },
  {
    id: 'good-grade',
    title: '성적 상승!',
    description: '요즘 공부 흐름이 좋다.\n쉬는 시간에 담임 선생님이 지나가다 "요즘 꽤 열심히 하더라? 이대로만 계속 해" 하고 말씀하셨다.',
    condition: (s) => s.stats.academic >= 60 && s.week % 8 === 0 && s.week > 1,
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    choices: [
      {
        text: '"더 열심히 해야지!" — 의욕이 생긴다',
        effects: { academic: 2, mental: 3 },
        message: '칭찬을 들으니 기분이 좋다. 더 잘하고 싶다.',
      },
      {
        text: '"이 정도면 됐지~" — 여유를 부린다',
        effects: { mental: 2, social: 1 },
        message: '좀 쉬어도 되겠지. 친구들이 "부럽다" 한다.',
      },
    ],
  },
  {
    id: 'parent-pressure',
    title: '부모님의 한마디',
    description: '저녁 식사 중. 부모님이 성적 이야기를 꺼내신다.\n"요즘 공부는 잘 되니?"',
    condition: (s) => s.week === 15 || s.week === 36,
    location: 'home',
    background: 'dinner_table',
    choices: [
      {
        text: '"네, 열심히 하고 있어요"',
        effects: { mental: -1 },
        message: '"그래, 기대하마." 부담이 좀 느껴진다.',
      },
      {
        text: '"...보통이요"',
        effects: { mental: -2 },
        message: '부모님 표정이 살짝 굳었다.',
      },
      {
        text: '"요즘 좀 힘들어요" — 솔직하게 말한다',
        effects: { mental: 2 },
        message: '부모님이 잠시 침묵하다가 "힘들면 말해. 같이 생각해보자" 하셨다.',
      },
    ],
  },
  // ===== 반장 선거 이벤트 =====
  {
    id: 'class-president', title: '반장 선거',
    description: '반장 선거 시즌이다.\n선생님이 교탁 앞에 서서 말했다.\n"자, 반장 후보 나올 사람 있나요?"',
    week: 3,
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '"제가 할게요!" — 손을 든다', effects: { social: 2, mental: 1 },
        message: '손을 들었다. 교실이 술렁인다. 이제 선거 연설을 해야 한다.' },
      { text: '가만히 있는다...', effects: { mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '민재가 조용히 손을 들었다. "아무도 안 하면 제가 할게요." 민재가 반장이 됐다. 의외로 차분하게 나서는 타입이다.' },
    ],
  },
  {
    id: 'class-president-speech', title: '선거 연설',
    description: '교탁 앞에 섰다.\n반 친구들의 시선이 모인다.\n무슨 말을 해야 할까?',
    // 같은 해 출마(c0) 후 + 연설/win/lose 미발동
    condition: (s) => s.events.some(e => e.id === 'class-president' && e.year === s.year && e.resolvedChoice === 0)
      && !s.events.some(e => e.id === 'class-president-speech' && e.year === s.year)
      && !s.events.some(e => (e.id === 'class-president-win' || e.id === 'class-president-lose') && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '"열심히 하겠습니다!" — 진심을 담아 외친다', effects: { social: 3, mental: 1 }, fatigueEffect: 2,
        message: '떨리는 목소리지만 진심이 닿았다. 박수 소리가 들린다.' },
      { text: '"여러분의 의견을 듣겠습니다" — 차분하게 약속한다', effects: { social: 2, mental: 2 }, fatigueEffect: 2,
        message: '담담했지만 어른스러운 인상을 남겼다. 몇몇이 고개를 끄덕였다.' },
      { text: '"...잘 부탁드립니다" — 짧게 끝낸다', effects: { social: 1 }, fatigueEffect: 1,
        message: '짧게 마쳤다. 무난했지만 인상에 남지 않았다.' },
    ],
  },
  {
    id: 'class-president-win', title: '반장 당선!',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 불렸다!\n반 친구들이 박수를 쳐준다.',
    // 매년 발동: 같은 해 출마(c0) + 같은 해에 -lose/-win 미발동
    condition: (s) => s.events.some(e => e.id === 'class-president' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social >= 40
      && !s.events.some(e => e.id === 'class-president-lose' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-win' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '반장이 됐다!', effects: { social: 5, mental: 3 }, fatigueEffect: 2,
        message: '당선됐다! 떨리지만 잘 해보자.' },
    ],
  },
  {
    id: 'class-president-lose', title: '반장 선거 결과',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 아니다.\n가슴이 조금 내려앉았다.',
    condition: (s) => s.events.some(e => e.id === 'class-president' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social < 40
      && !s.events.some(e => e.id === 'class-president-win' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-lose' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '결과를 받아들인다', effects: { social: 1, mental: -1 },
        message: '아깝게 졌다. 조금 씁쓸하지만 인정한다.' },
    ],
  },
  {
    id: 'class-president-vice', title: '부반장 제안',
    description: '쉬는 시간에 당선된 반장이 다가온다.\n"야, 부반장 자리 아직 비었는데... 어때?"',
    condition: (s) => s.events.some(e => e.id === 'class-president-lose' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-vice' && e.year === s.year),
    location: 'classroom', background: 'classroom_{school}', speakers: ['minjae'],
    choices: [
      { text: '"좋아, 해볼게" — 부반장을 맡는다', effects: { social: 4, mental: 2 }, fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '부반장이 됐다! 민재가 "우리 잘 해보자!" 하며 주먹을 내밀었다.' },
      { text: '"아니, 괜찮아..." — 정중히 거절한다', effects: { mental: 1 },
        message: '다음에 기회가 있을 거다. 지금은 조용히 지내자.' },
    ],
  },
  {
    id: 'class-president-2', title: '2학기 반장 선거',
    description: '2학기가 시작됐다. 선생님이 교탁 앞에 서서 말했다.\n"이번 학기 반장, 나올 사람 있나요?"',
    week: 25, location: 'classroom', background: 'classroom_{school}',
    choices: [
      { text: '"제가 할게요!" — 손을 든다', effects: { social: 2, mental: 1 },
        message: '손을 들었다. 올해는 조금 더 자신 있게.' },
      { text: '가만히 있는다...', effects: { mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '민재가 다시 손을 들었다. "할 사람 없으면 제가 하죠." 2학기도 민재가 반장. 책임감이 대단하다.' },
    ],
  },
  {
    id: 'class-president-2-speech', title: '2학기 선거 연설',
    description: '다시 교탁 앞에 섰다.\n이번엔 조금 덜 떨린다. 어떤 말을 할까.',
    // 같은 해 2학기 출마(c0) 후 + 2학기 연설/win/lose 미발동
    condition: (s) => s.events.some(e => e.id === 'class-president-2' && e.year === s.year && e.resolvedChoice === 0)
      && !s.events.some(e => e.id === 'class-president-2-speech' && e.year === s.year)
      && !s.events.some(e => (e.id === 'class-president-2-win' || e.id === 'class-president-2-lose') && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '"이번 학기엔 더 잘 해보겠습니다" — 1학기 경험을 살려 다짐한다', effects: { social: 3, mental: 1 }, fatigueEffect: 2,
        message: '경험에서 우러난 말이라 무게가 달랐다. 호응이 좋았다.' },
      { text: '"새로운 계획을 준비했습니다" — 구체적인 약속을 한다', effects: { social: 2, mental: 2, academic: 1 }, fatigueEffect: 2,
        message: '준비한 만큼 차분하게 전했다. "오, 진심이네" 누군가가 작게 말했다.' },
      { text: '"잘 부탁드립니다" — 짧게 마무리한다', effects: { social: 1 }, fatigueEffect: 1,
        message: '담담히 끝냈다. 평이했다.' },
    ],
  },
  {
    id: 'class-president-2-win', title: '2학기 반장 당선!',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 불렸다!\n2학기 반장이다.',
    condition: (s) => s.events.some(e => e.id === 'class-president-2' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social >= 50
      && !s.events.some(e => e.id === 'class-president-2-lose' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-2-win' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '2학기도 반장이다!', effects: { social: 5, mental: 3 }, fatigueEffect: 2,
        message: '이번엔 더 잘 해내고 싶다. 반 친구들의 기대가 느껴진다.' },
    ],
  },
  {
    id: 'class-president-2-lose', title: '2학기 반장 선거 결과',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 아니다.\n이번에도 아깝게 졌다.',
    condition: (s) => s.events.some(e => e.id === 'class-president-2' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social < 50
      && !s.events.some(e => e.id === 'class-president-2-win' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-2-lose' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '결과를 받아들인다', effects: { social: 1, mental: -1 },
        message: '인기를 더 쌓아야겠다는 생각이 든다. 옆자리 친구가 "다음 학기엔 될 거야" 하며 어깨를 두드렸다.' },
    ],
  },
  // ===== 반장 전용 이벤트 =====
  {
    id: 'president-errand', title: '반장의 심부름',
    description: '선생님이 부르신다.\n"반장, 교무실에서 유인물 좀 가져다줄래? 아, 그리고 다음 주 현장학습 인원 확인도 부탁해."',
    location: 'hallway', background: 'hallway_{school}',
    choices: [
      { text: '"네, 알겠습니다!" — 성실하게 처리한다', effects: { social: 2, academic: 1 }, fatigueEffect: 3,
        message: '바쁘지만 선생님이 "역시 믿음직하다" 하셨다. 뿌듯하다.' },
      { text: '"아... 네..." — 좀 귀찮지만 한다', effects: { social: 1 }, fatigueEffect: 2,
        message: '시킨 건 했지만 의욕은 없었다. 반장이 이렇게 피곤한 거였나.' },
    ],
    condition: (s) => isClassPresident(s) && !s.isVacation && s.week > 4,
  },
  {
    id: 'president-mediate', title: '반장의 중재',
    description: '반 친구 둘이 크게 싸우고 있다.\n선생님이 자리를 비운 사이, 다들 반장인 나를 쳐다본다.\n"야, 너가 좀 말려봐..."',
    location: 'classroom', background: 'classroom_{school}_afternoon',
    choices: [
      { text: '중간에서 양쪽 이야기를 듣는다', effects: { social: 4, mental: -2 }, fatigueEffect: 3,
        message: '쉽지 않았지만 결국 둘 다 진정시켰다. "고마워, 반장." 피곤하지만 보람 있다.' },
      { text: '"선생님 오실 때까지 기다리자" — 넘긴다', effects: { social: -1, mental: 1 },
        message: '결국 담임이 와서 해결했다. "반장이 좀 나섰어야지..." 누군가가 작게 말했다.' },
    ],
    condition: (s) => isClassPresident(s) && !s.isVacation && s.stats.social >= 40,
  },
  {
    id: 'president-speech', title: '조회 시간 발표',
    description: '월요일 조회. 담임이 "반장, 이번 주 공지사항 전달해" 한다.\n반 전체가 나를 본다. 긴장된다.',
    location: 'classroom', background: 'classroom_{school}',
    choices: [
      { text: '당당하게 발표한다', effects: { social: 3, mental: 2 }, fatigueEffect: 2,
        message: '떨렸지만 잘 해냈다! 끝나고 지훈이가 "야, 반장 제법인데?" 했다.' },
      { text: '후다닥 빨리 끝낸다', effects: { social: 1, mental: -1 },
        message: '우물우물 빨리 끝냈다. 아무도 뭐라 안 했지만... 좀 창피하다.' },
    ],
    condition: (s) => isClassPresident(s) && !s.isVacation,
  },
  // ===== 비반장: 반장을 지켜보는 이벤트 =====
  {
    id: 'watching-president', title: '민재가 지쳐 보인다',
    description: '요즘 반장 민재가 피곤해 보인다. 성적도 유지해야 하고, 반장 일도 해야 하고...\n쉬는 시간에 민재가 노트를 펴놓고 한숨을 쉬고 있다.\n"야... 시간이 안 된다 진짜..."',
    location: 'classroom', background: 'classroom_{school}_afternoon',
    speakers: ['minjae'],
    choices: [
      { text: '"괜찮아? 뭐 도와줄까?" — 다가간다', effects: { social: 3, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '"진짜? 고마워..." 민재가 노트를 덮었다. 반장 일에 성적까지, 혼자 다 하려는 애다.' },
      { text: '조용히 지나간다', effects: { mental: 1 },
        message: '민재도 버거운 거구나. 전교 1등이 쉬운 게 아니라는 걸 처음 느꼈다.' },
    ],
    condition: (s) => !isClassOfficer(s) && !s.isVacation && s.week > 6 && s.stats.social >= 35,
  },

  // ===== 생일 이벤트 (매년 고정 주차 발동) =====
  {
    id: 'jihun-birthday', title: '지훈이 생일',
    description: '오늘이 지훈이 생일이다.\n단톡방에 생일 축하 메시지가 쏟아진다.',
    week: 14,
    location: 'classroom', background: 'classroom_{school}_afternoon',
    speakers: ['jihun'],
    condition: (s) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && (s.year === 1 || jihun.intimacy >= 30);
    },
    choices: [
      { text: '선물을 사서 준다 (-2만원)', effects: { social: 3, mental: 2 }, moneyEffect: -2,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 6 }],
        message: '지훈이가 진짜 좋아했다. "야 너 최고다!" 돈 아깝지 않다.' },
      { text: '좋아하는 농구화 끈 세트를 고른다 (-5만원)', effects: { social: 4, mental: 4 }, moneyEffect: -5,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 10 }],
        message: '지훈이가 신발끈을 보더니 입이 쩍 벌어졌다. "야, 이거... 너 진짜 나랑 오래 볼 생각인가 보네." 웃으며 말했지만 진지한 눈이었다.' },
      { text: '카톡으로 축하만 한다', effects: { social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '"축하해~" 보냈다. 지훈이가 "고마워~" 했다. 좀 성의없었나?' },
    ],
    femaleChoices: [
      { text: '선물을 사서 준다 (-2만원)', effects: { social: 3, mental: 2 }, moneyEffect: -2,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 6 }],
        message: '지훈이가 진짜 좋아했다. "야 너 최고다!" 돈 아깝지 않다.' },
      { text: '배드민턴 라켓 그립테이프 세트를 고른다 (-5만원)', effects: { social: 4, mental: 4 }, moneyEffect: -5,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 10 }],
        message: '지훈이가 그립테이프를 보더니 입이 쩍 벌어졌다. "야, 이거... 너 진짜 나랑 오래 칠 생각인가 보네." 웃으며 말했지만 진지한 눈이었다.' },
      { text: '카톡으로 축하만 한다', effects: { social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '"축하해~" 보냈다. 지훈이가 "고마워~" 했다. 좀 성의없었나?' },
    ],
  },
  {
    id: 'subin-birthday', title: '수빈이 생일',
    description: '오늘이 수빈이 생일이라는 게 떠올랐다.\n2학기가 시작되고 9월이다.',
    week: 29,
    location: 'classroom', background: 'classroom_{school}_afternoon',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && (s.year === 1 || subin.intimacy >= 30);
    },
    choices: [
      { text: '선물을 준비했다 (-2만원)', effects: { social: 2, mental: 2 }, moneyEffect: -2,
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '수빈이가 "어, 어떻게 알았어!" 하며 눈이 커졌다. "고마워..." 수줍게 웃었다.' },
      { text: '여행 에세이 책 한 권을 고른다 (-5만원)', effects: { social: 3, mental: 4 }, moneyEffect: -5,
        npcEffects: [{ npcId: 'subin', intimacyChange: 10 }],
        message: '수빈이가 책을 받아 들고 한참 아무 말도 안 했다. "...너, 내가 어디 떠나고 싶어하는 거 알았어?" 목소리가 살짝 떨렸다.' },
      { text: '카톡으로 축하한다', effects: { social: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 1 }],
        message: '"고마워~" 수빈이가 이모티콘을 보냈다.' },
    ],
  },
  {
    id: 'yuna-birthday', title: '유나의 생일',
    description: '오늘이 유나 생일인 걸 단톡에서 알게 됐다.\n유나는 조용히 자리에 앉아 있다.',
    // W38 (W37 단원평가/기말 알림과 충돌 회피 — speakers 우선 규칙으로 시험 알림이 영구 손실되던 문제)
    week: 38,
    location: 'classroom', background: 'classroom_{school}_afternoon',
    speakers: ['yuna'],
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && (s.year === 1 || yuna.intimacy >= 30);
    },
    choices: [
      { text: '작은 선물을 준다 (-2만원)', effects: { social: 2, mental: 2 }, moneyEffect: -2,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 6 }],
        message: '유나가 조용히 받아들었다. "...고마워." 살짝 붉어진 귀가 보였다.' },
      { text: '별 장식 머리핀 세트를 준비한다 (-5만원)', effects: { social: 3, mental: 4 }, moneyEffect: -5,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 10 }],
        message: '유나가 머리핀을 한참 보더니 말했다. "...이거, 내가 늘 쓰는 거 알았어?" 그리고 바로 꽂았다. 교실이 창문 빛에 빛났다.' },
      { text: '조용히 카톡으로 축하한다', effects: { social: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '"고마워" 짧은 답장이 왔다. 유나답다.' },
    ],
  },
  ...JUNHA_EVENTS,

  // ===== M4: 돈 싱크 이벤트 =====
  // 수학여행 — 중1 가을 (Y2 W28) — 경주
  {
    id: 'school-trip-middle',
    title: '수학여행 신청서',
    description: '담임이 종이 한 장을 나눠준다.\n"다음 달 수학여행이다. 경주 2박 3일, 참가비 10만원. 내일까지 제출."\n책상에 신청서가 놓인다.\n옆자리에서 "같이 가야지?" 하는 목소리가 들린다.',
    week: 28,
    condition: (s) => s.year === 2 && !s.isVacation,
    location: 'classroom',
    background: 'classroom_middle_afternoon',
    speakers: ['jihun'],
    choices: [
      {
        text: '"간다" — 신청서를 낸다 (-10만원)',
        effects: { social: 4, mental: 5, talent: 1 },
        fatigueEffect: 6,
        moneyEffect: -10,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 4 }, { npcId: 'minjae', intimacyChange: 1 }],
        message: '경주 밤, 숙소 복도에서 지훈이랑 몰래 라면을 끓였다. 걸려서 혼났지만 그게 더 웃겼다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 6,
          toneTag: 'warm',
          recallText: '중1 수학여행 밤, 숙소 복도의 라면 냄새.',
          npcIds: ['jihun'],
        },
      },
      {
        text: '"돈이 좀..." — 집안 사정으로 불참',
        effects: { social: -2, mental: -3 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -2 }],
        message: '수학여행 기간, 교실에 남은 몇 명 중 하나였다. 단톡방 사진을 보며 좀 먹먹했다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 4,
          toneTag: 'regret',
          recallText: '수학여행 간 친구들 사진만 봤다. 교실이 유난히 넓었다.',
        },
      },
      {
        text: '"좀 더 생각해볼게" — 결정을 미룬다',
        effects: { mental: -1 },
        message: '신청서를 들고만 있다가 버렸다. 결국 결정을 미룬 것이다.',
      },
    ],
  },

  // 수학여행 — 고1 가을 (Y5 W28) — 제주
  {
    id: 'school-trip-high',
    title: '제주 수학여행',
    description: '고등학교 첫 수학여행이다.\n"제주 3박 4일, 참가비 10만원. 이게 마지막일 거다."\n담임이 신청서를 나눠준다.\n단톡방에서 이미 "너 갈 거지?" 확인이 돌고 있다.',
    week: 28,
    condition: (s) => s.year === 5 && !s.isVacation,
    location: 'classroom',
    background: 'classroom_high_afternoon',
    // M5 Phase 3-Y: 준하는 Y6 전학생이라 Y5 수학여행엔 없음 (met 조기 설정 버그 수정)
    speakers: ['jihun'],
    choices: [
      {
        text: '"간다" — 마지막 수학여행이니까 (-10만원)',
        effects: { social: 4, mental: 6, talent: 1 },
        fatigueEffect: 7,
        moneyEffect: -10,
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 3 },
        ],
        message: '제주 해변에서 밤까지 놀았다. 파도 소리를 들으면서 "우리 진짜 고3 되면 이런 거 못 해" 누군가가 말했다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 7,
          toneTag: 'warm',
          recallText: '고1 제주 밤, 파도 소리에 섞여 친구들이 웃었다.',
          npcIds: ['jihun'],
        },
      },
      {
        text: '"공부해야지" — 불참',
        effects: { academic: 2, mental: -4, social: -3 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -3 }],
        message: '텅 빈 교실에서 참고서를 폈다. 집중은 안 됐지만 "난 나대로 달렸다"고 자신에게 말했다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 5,
          toneTag: 'regret',
          recallText: '제주에 간 친구들 대신, 나는 빈 교실에서 참고서만 넘겼다.',
        },
      },
    ],
  },

  // 졸업 준비 — 초등 (Y1 W45, 졸업식 1주 전) — 겨울방학 중 단체 신청
  {
    id: 'graduation-prep-elementary',
    title: '졸업 앨범',
    description: '졸업식 전주. 교실 뒤에 졸업 앨범 신청서가 붙었다.\n"사진관 촬영 + 앨범 + 롤링페이퍼 세트 5만원."\n반 애들이 하나씩 줄을 선다.\n신청할까, 말까.',
    week: 45,
    condition: (s) => s.year === 1,
    location: 'classroom',
    background: 'classroom_elementary_afternoon',
    choices: [
      {
        text: '신청한다 — 남길 건 남기자 (-5만원)',
        effects: { social: 3, mental: 4 },
        moneyEffect: -5,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }, { npcId: 'minjae', intimacyChange: 1 }],
        message: '사진관에서 반 전체가 웃으면서 찍었다. 롤링페이퍼에 "우리 중학교 가서도 보자"가 여러 장 적혔다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 7,
          toneTag: 'warm',
          recallText: '초등 졸업 앨범, 롤링페이퍼에 "중학교 가서도 보자"가 여러 장.',
          npcIds: ['jihun', 'minjae'],
        },
      },
      {
        text: '"나중에 보면 되지" — 스킵한다',
        effects: { mental: -2 },
        message: '반 애들이 앨범을 펼쳐 보며 웃는 동안 혼자 책가방을 쌌다. 나중에 보자고 했는데, 나중이 올까.',
      },
    ],
  },

  // 졸업 준비 — 고등 (Y7 W45, 졸업식 1주 전) — 겨울방학 중
  {
    id: 'graduation-prep-high',
    title: '졸업 준비',
    description: '수능도 끝났고, 졸업식이 다음 주다.\n"졸업 정장 대여 + 앨범 + 꽃다발 세트 5만원, 학교에서 단체 신청 받는다."\n마지막이라는 말이 유난히 묵직하다.',
    week: 45,
    condition: (s) => s.year === 7,
    location: 'classroom',
    background: 'classroom_high_afternoon',
    choices: [
      {
        text: '제대로 준비한다 (-5만원)',
        effects: { social: 3, mental: 5 },
        moneyEffect: -5,
        message: '정장을 입고 거울 앞에 서니, 어색한데도 뭔가 달라 보인다. 친구들과 교정에서 찍은 사진은 한참 보게 됐다.',
        memorySlotDraft: {
          category: 'growth',
          importance: 8,
          toneTag: 'breakthrough',
          recallText: '고3 졸업, 정장 입고 거울 앞에 선 낯선 얼굴.',
        },
      },
      {
        text: '"그냥 평소 옷으로 갈래" — 간소하게',
        effects: { mental: 1 },
        message: '평소 옷 그대로 졸업식에 갔다. 정장 입은 애들 사이에서 조금 동떨어진 기분이었다.',
      },
    ],
  },

  // 동아리/학원 선택 — Y5 W2 (고1 입학 다음 주)
  {
    id: 'club-academy-choice-y5',
    title: '방과 후, 뭐 할래',
    description: '고등학교 둘째 주. 방과 후 활동 배정이 시작됐다.\n게시판에 붙은 종이 — "동아리 활동 10만원 / 학원 등록 10만원 / 자율".\n옆반에서는 이미 다 정한 듯 빠르게 움직인다.\n"너는 어떻게 할 거야?" 누군가가 묻는다.',
    week: 2,
    condition: (s) => s.year === 5 && !s.isVacation,
    location: 'classroom',
    background: 'classroom_high',
    choices: [
      {
        text: '"학원 등록할게" — 공부에 집중 (-10만원, 학업 루틴 20% 버프 8주)',
        effects: { academic: 2, mental: -1 },
        moneyEffect: -10,
        message: '학원을 등록했다. 선생님이 "고1이 제일 중요하다"고 했다. 주 3회, 이제 저녁이 학원에서 흘러간다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 5,
          toneTag: 'resolve',
          recallText: '고1 봄, 학원 등록증을 받던 날. "이제 진짜 시작이다."',
        },
        addBuff: {
          id: 'y5-academy-boost',
          name: '학원 집중 기간',
          target: 'study',
          amount: 0.2,
          remainingWeeks: 8,
        },
      },
      {
        text: '"동아리 들어갈래" — 사람 (-10만원, 특기 루틴 15% 버프 8주)',
        effects: { social: 3, talent: 2, mental: 3 },
        moneyEffect: -10,
        message: '동아리에 이름을 적었다. 선배들이 웃으며 맞아줬다. "공부만 하면 재미없잖아?" — 맞는 말이었다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 5,
          toneTag: 'warm',
          recallText: '고1 봄, 동아리방 문을 처음 연 날의 어색한 공기.',
        },
        addBuff: {
          id: 'y5-club-boost',
          name: '동아리 활동',
          target: 'talent',
          amount: 0.15,
          remainingWeeks: 8,
        },
      },
      {
        text: '"알아서 할게" — 돈 아낀다',
        effects: { mental: -1 },
        message: '아무 데도 안 들어갔다. 방과 후는 자유로웠지만, 반 친구들 이야기에 끼기가 조금 어색해졌다.',
      },
    ],
  },
  // ===== HARD 크라이시스 이벤트 (연간 1회 상한, hardCrisisYears 가드) =====
  // v1.2 §4.3 — middle-burnout 외 3종. 각 학년대 변곡점에 배치.
  {
    id: 'high-panic',
    title: '새벽 세 시, 숨이 막혔다',
    description: '문제집 펴놓고 졸다가 깼다.\n시계를 보니 새벽 세 시.\n갑자기 심장이 빠르게 뛰고, 숨을 쉬어도 들이마신 느낌이 안 든다.\n"...뭐지, 이거."',
    condition: (s) => s.year >= 5 && s.year <= 7 && s.stats.mental <= 55 && s.stats.academic >= 50,
    location: 'home',
    background: 'bedroom_night',
    choices: [
      {
        text: '책상에서 벗어나 현관문 밖으로 나간다',
        effects: { mental: -2 },
        fatigueEffect: -10,
        message: '복도 끝 계단참에 잠깐 앉아 있었다. 차가운 공기에 숨이 겨우 돌아왔다. 책상으로 돌아가지는 못했다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 7,
          toneTag: 'regret',
          recallText: '새벽 세 시, 계단참에 앉아 숨을 고르던 밤.',
        },
      },
      {
        text: '숨 고르고 조금만 더 공부한다',
        effects: { academic: 2, mental: -6 },
        fatigueEffect: 8,
        message: '다시 책상으로 돌아왔다. 글자는 눈을 스쳐만 지나갔지만, 어쨌든 앉아 있었다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 6,
          toneTag: 'regret',
          recallText: '패닉을 참고 책상에 억지로 앉아 있던 새벽.',
        },
      },
      {
        text: '엄마 방 문을 두드린다 — 도움을 청한다',
        effects: { mental: 6, social: 1 },
        fatigueEffect: -5,
        message: '엄마가 놀라서 일어났다. 말없이 물 한 컵을 내밀고 옆에 앉았다. "...내일 병원 가자." 안도와 부끄러움이 섞였지만, 혼자가 아니었다.',
        memorySlotDraft: {
          category: 'growth',
          importance: 8,
          toneTag: 'breakthrough',
          recallText: '엄마 방 문을 두드린 새벽. 혼자가 아니었다.',
        },
      },
    ],
  },
  {
    id: 'family-strain',
    title: '식탁 위 침묵',
    description: '저녁 식탁. 오늘따라 공기가 묵직하다.\n아빠가 수저를 놓으며 말한다.\n"요즘 너, 뭐 하는 거니?"\n엄마는 나를 안 보신다. 그게 더 서늘했다.',
    condition: (s) => s.year >= 3 && s.year <= 6 && (s.idleWeeks >= 4 || (s.stats.mental <= 45 && s.stats.academic <= 55)),
    location: 'home',
    background: 'dinner_table',
    choices: [
      {
        text: '"제가 알아서 할게요" — 맞받아친다',
        effects: { mental: 1, social: -2 },
        fatigueEffect: 5,
        message: '수저를 놓고 방으로 들어갔다. 문을 닫자마자 벽에 기대어 한참 앉아 있었다. 방어하긴 했는데 이겼다는 느낌은 없었다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 7,
          toneTag: 'regret',
          recallText: '식탁을 뛰쳐나와 방문 안쪽에 기대어 앉아 있던 저녁.',
        },
      },
      {
        text: '묵묵히 듣는다',
        effects: { academic: 2, mental: -5 },
        fatigueEffect: 3,
        message: '한참 잔소리가 이어졌다. 반박하지 않았다. 끝나고 방에 들어와 책을 폈지만, 글자가 튕겨나갔다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 6,
          toneTag: 'regret',
          recallText: '식탁에서 묵묵히 잔소리를 다 듣던 날.',
        },
      },
      {
        text: '"저 사실 힘들어요" — 솔직하게 말한다',
        effects: { mental: 5 },
        fatigueEffect: -5,
        message: '아빠가 한참을 가만히 있었다. 엄마가 "...왜 이제 말해" 하셨다. 식탁 위 공기가 처음으로 풀어졌다.',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 8,
          toneTag: 'warm',
          recallText: "'저 힘들어요' — 그 말에 엄마 표정이 무너지던 저녁.",
        },
      },
    ],
  },
  {
    id: 'identity-crisis',
    title: '내가 뭘 하고 싶은 거지',
    description: '야자 끝나고 옥상에 혼자 올라왔다.\n친구들은 다 꿈을 말하는데, 나는 아무것도 떠오르지 않는다.\n"...나 뭐 하고 있는 거지."\n하늘이 이상하게 멀어 보였다.',
    condition: (s) => (s.year === 5 || s.year === 6) && s.stats.mental <= 55 && !s.events.some(e => e.id === 'identity-crisis'),
    location: 'rooftop',
    background: 'rooftop_sunset',
    choices: [
      {
        text: '아무한테도 말하지 않고 혼자 삭인다',
        effects: { mental: -4, academic: -1 },
        fatigueEffect: 5,
        message: '집에 가서 침대에 누웠다. 천장만 한참 쳐다봤다. 결국 아무도 모르게 넘어갔다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 6,
          toneTag: 'regret',
          recallText: '아무한테도 말하지 않고 천장만 쳐다보던 그 밤.',
        },
      },
      {
        text: '담임한테 털어놓는다',
        effects: { mental: 3, academic: 1 },
        fatigueEffect: -3,
        message: '담임은 답을 주진 않았다. 대신 "지금 모르는 게 정상이야" 한마디만 했다. 그 한마디가 오래 남았다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 7,
          toneTag: 'resolve',
          recallText: "'지금 모르는 게 정상이야' — 담임이 해준 한마디.",
        },
      },
      {
        text: '지훈이한테 전화해서 같이 밤까지 얘기한다',
        effects: { mental: 5, social: 2 },
        fatigueEffect: 5,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 4 }],
        message: '지훈이도 별 답은 없었다. 근데 같이 "아 몰라, 졸업이나 하자" 웃었다. 그거면 됐다.',
        memorySlotDraft: {
          category: 'growth',
          importance: 8,
          toneTag: 'warm',
          recallText: '지훈이랑 "아 몰라, 졸업이나 하자" 웃던 밤.',
          npcIds: ['jihun'],
        },
      },
    ],
  },
  // ===== SOFT 크라이시스 이벤트 (연간 2건 상한) =====
  // NPC 친밀도 기반 관계 위기. 화해/방치 선택으로 친밀도 궤적 분기.
  {
    id: 'yuna-misunderstanding',
    title: '유나의 차가운 인사',
    description: '아침에 유나랑 눈이 마주쳤는데 평소와 다르다.\n웃지 않았다. 짧게 고개만 까딱하고 지나갔다.\n쉬는 시간에 다가가려 하니, 유나가 다른 친구랑만 얘기한다.\n"...뭐지."',
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 40 && yuna.intimacy <= 75
        && s.year >= 2 && s.year <= 5
        && !s.isVacation;
    },
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    speakers: ['yuna'],
    choices: [
      {
        text: '"유나야, 나한테 뭐 서운한 거 있어?" — 먼저 묻는다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 4 }],
        message: '유나가 잠깐 놀라더니 한숨을 쉬었다. "...아니, 내가 괜히 예민했어." 오해를 풀었다.',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 5,
          toneTag: 'warm',
          recallText: "'나한테 뭐 서운한 거 있어?' — 유나가 괜히 예민했다고 했다.",
          npcIds: ['yuna'],
        },
      },
      {
        text: '신경 안 쓰기로 한다',
        effects: { mental: -2, social: -1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: -8 }],
        message: '유나랑의 거리가 그날부터 조금씩 멀어졌다. 교실에서 인사는 해도, 전처럼 같이 다니진 않았다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 5,
          toneTag: 'regret',
          recallText: '유나랑 멀어진 그 봄. 이유는 끝내 못 물어봤다.',
          npcIds: ['yuna'],
        },
      },
      {
        text: '시간이 지나면 풀린다고 생각한다',
        effects: { mental: -1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: -3 }],
        message: '며칠이 지났는데 유나랑은 어정쩡한 상태 그대로다. 풀지도 않고, 끊기지도 않은 채.',
      },
    ],
  },
  {
    id: 'subin-drift',
    title: '수빈이 멀어진다',
    description: '점심시간, 수빈이가 다른 반 애들이랑 웃으며 지나간다.\n예전엔 자연스럽게 내 쪽으로 왔을 텐데, 눈도 안 마주쳤다.\n"...우리 아직 친한 거 맞나?"',
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 30 && subin.intimacy <= 65
        && s.year >= 3 && s.year <= 5
        && !s.isVacation;
    },
    location: 'hallway',
    background: 'hallway_{school}',
    speakers: ['subin'],
    choices: [
      {
        text: '방과 후 편의점에서 먼저 말 건다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 3 }],
        message: '수빈이가 살짝 놀라더니 "어, 오랜만이다" 했다. 예전만큼은 아니지만, 끈이 다시 이어진 느낌이다.',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 4,
          toneTag: 'warm',
          recallText: '편의점 앞에서 수빈이한테 먼저 말 건 오후.',
          npcIds: ['subin'],
        },
      },
      {
        text: '수빈이 새 친구 그룹에 같이 낀다',
        effects: { social: 3 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 1 }],
        message: '어색했지만 수빈이 친구들도 괜찮은 애들이었다. 수빈이랑은 예전 같진 않아도, 그룹으로는 어울렸다.',
      },
      {
        text: '멀어지는 건 어쩔 수 없다고 받아들인다',
        effects: { mental: -2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: -6 }],
        message: '먼저 말을 안 걸었다. 수빈이도 마찬가지였다. 같은 학원 다니던 게 언제 적 일인지 가물가물해졌다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 4,
          toneTag: 'regret',
          recallText: '수빈이랑은 말없이 멀어졌다. 누구 탓도 아닌 채로.',
          npcIds: ['subin'],
        },
      },
    ],
  },
  {
    id: 'jihun-envy',
    title: '지훈이 말끝에 남은 것',
    description: '방과 후 지훈이랑 편의점에서 컵라면 먹는 중.\n지훈이가 씩 웃으며 말한다.\n"너 요즘 진짜 잘나가네." 농담 같긴 한데, 끝이 살짝 내려갔다.\n잠깐 정적.',
    condition: (s) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && jihun.intimacy >= 45 && jihun.intimacy <= 75
        && s.year >= 2 && s.year <= 5
        && (s.stats.social >= 60 || s.stats.talent >= 60 || s.stats.academic >= 65)
        && !s.isVacation;
    },
    location: 'convenience_store',
    background: 'convenience_store',
    speakers: ['jihun'],
    choices: [
      {
        text: '"무슨 소리야, 너가 더 잘하잖아" — 진심으로 말한다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 4 }],
        message: '지훈이 눈이 커졌다가, "야, 닭살이야" 하고 웃었다. 근데 그 웃음은 진짜였다.',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 5,
          toneTag: 'warm',
          recallText: "편의점에서 지훈이한테 '너가 더 잘하잖아' 했던 오후.",
          npcIds: ['jihun'],
        },
      },
      {
        text: '"뭐야 갑자기" — 쿨하게 넘긴다',
        effects: { mental: -1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -3 }],
        message: '지훈이가 "그래그래" 하고 컵라면만 후루룩 먹었다. 뭐가 남은 느낌이었다.',
      },
      {
        text: '"우리 토요일에 농구 하자" — 화제 돌리며 제안한다',
        effects: { social: 1, health: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 2 }],
        message: '지훈이 "콜" 하고 활짝 웃었다. 컵라면 국물 마시면서 토요일 얘기만 했다.',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 4,
          toneTag: 'warm',
          recallText: '편의점에서 지훈이랑 토요일 농구 약속을 정한 오후.',
          npcIds: ['jihun'],
        },
      },
    ],
    femaleChoices: [
      {
        text: '"무슨 소리야, 너가 더 잘하잖아" — 진심으로 말한다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 4 }],
        message: '지훈이 눈이 커졌다가, "야, 닭살이야" 하고 웃었다. 근데 그 웃음은 진짜였다.',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 5,
          toneTag: 'warm',
          recallText: "편의점에서 지훈이한테 '너가 더 잘하잖아' 했던 오후.",
          npcIds: ['jihun'],
        },
      },
      {
        text: '"뭐야 갑자기" — 쿨하게 넘긴다',
        effects: { mental: -1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -3 }],
        message: '지훈이가 "그래그래" 하고 컵라면만 후루룩 먹었다. 뭐가 남은 느낌이었다.',
      },
      {
        text: '"우리 토요일에 배드민턴 치자" — 화제 돌리며 제안한다',
        effects: { social: 1, health: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 2 }],
        message: '지훈이 "콜" 하고 활짝 웃었다. 컵라면 국물 마시면서 토요일 얘기만 했다.',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 4,
          toneTag: 'warm',
          recallText: '편의점에서 지훈이랑 토요일 배드민턴 약속을 정한 오후.',
          npcIds: ['jihun'],
        },
      },
    ],
  },
  {
    id: 'haeun-distance',
    title: '하은 선배의 편지',
    description: '사물함에 접힌 종이가 끼어 있다.\n하은 선배 글씨다.\n"잘 지내지? 나 고등학교 가서 정신없어. 이제 자주는 못 볼 것 같아.\n네가 중학교 잘 다니면 그걸로 됐어."\n짧은 편지 아래에, 작게 이름이 쓰여 있었다.',
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return !!haeun?.met && haeun.intimacy >= 40 && haeun.intimacy <= 80
        && s.year === 4
        && !s.isVacation;
    },
    location: 'hallway',
    background: 'hallway_{school}',
    choices: [
      {
        text: '답장을 길게 써서 학교 우편함에 넣는다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 3 }],
        message: '한 시간 동안 답장을 썼다. "선배 덕분에 중학교 버텼어요." 우편함에 넣고 돌아오는 길, 이상하게 후련했다.',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 5,
          toneTag: 'warm',
          recallText: '하은 선배한테 한 시간 걸려 쓴 답장.',
          npcIds: ['haeun'],
        },
      },
      {
        text: '편지를 가방에 넣고 한참 못 꺼낸다',
        effects: { mental: -2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: -4 }],
        message: '답장을 써야지 써야지 하다가 학기가 다 지나갔다. 종이는 가방 구석에서 구겨졌다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 4,
          toneTag: 'regret',
          recallText: '하은 선배 편지. 끝내 답장을 못 쓴 채로 학기가 지나갔다.',
          npcIds: ['haeun'],
        },
      },
      {
        text: '"자연스러운 거지" — 편지만 보관하고 접는다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: -2 }],
        message: '편지를 책상 서랍 맨 아래에 넣었다. 슬프진 않았다. 어느 관계는 이렇게 끝나는 거니까.',
        memorySlotDraft: {
          category: 'growth',
          importance: 4,
          toneTag: 'resolve',
          recallText: '하은 선배 편지를 서랍 맨 아래 넣은 날. 슬프진 않았다.',
          npcIds: ['haeun'],
        },
      },
    ],
  },

  // ===== Phase 2.2: Y1 친밀도 도달형 이벤트 =====
  // 친밀도 게이트(30/50/70/90)로 5명 NPC를 Y1에 5개씩 균등화.
  // week 없음 + condition으로 도달 시 conditionalEvents 풀 진입 (1회성 자동 보장).
  // doyun 30 슬롯은 위쪽 doyun-comic-share 정비로 채움.

  // --- yuna 30 ---
  {
    id: 'yuna-milk-duty',
    title: '우유 당번',
    description: '아침 조회 전, 유나가 우유 상자를 들고 교실 문 앞에 서 있다.\n"나 혼자 들 수 있는데... 같이 들면 더 빨리 끝나긴 해." 밝게 말하지만 손끝이 조금 빨개져 있다.',
    speakers: ['yuna'],
    location: 'classroom',
    background: 'classroom_elementary_spring',
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 30 && s.year === 1;
    },
    choices: [
      {
        text: '"같이 들자" — 한쪽 손잡이를 잡는다',
        effects: { social: 1, health: 1, mental: 1 },
        fatigueEffect: 2,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '유나가 "고마워, 사실 좀 무거웠어" 하고 웃는다. 교실까지 가는 복도가 짧게 느껴진다.',
        timeCost: 1,
      },
      {
        text: '"넌 명단 불러줘, 내가 나눠줄게"',
        effects: { social: 2, mental: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '유나가 번호를 또박또박 불러준다. 둘이 맞춰 움직이니 반 애들이 금방 우유를 받아 간다.',
        timeCost: 1,
      },
    ],
  },

  // --- yuna 50 ---
  {
    id: 'yuna-sticker-plan',
    title: '별 스티커 계획표',
    description: '쉬는 시간, 유나 책상 위에 작은 계획표가 펼쳐져 있다.\n국어, 수학, 피아노 옆에 별 스티커가 빼곡하다.\n유나가 얼른 가리려다 멈춘다. "이거 좀 유치하지?"',
    speakers: ['yuna'],
    location: 'classroom',
    background: 'classroom_elementary',
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 50 && s.year === 1;
    },
    choices: [
      {
        text: '"아니, 멋진데?" — 진심으로 말한다',
        effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '유나가 계획표 귀퉁이를 만지작거린다. "나 이거 다 채우면 괜히 안심돼."',
        timeCost: 1,
      },
      {
        text: '"나도 하나 만들어볼까" — 따라 해본다',
        effects: { academic: 2, mental: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '유나가 빈 종이를 찢어 건넨다. 별 모양은 삐뚤빼뚤하지만 둘이 만든 계획표가 나란히 놓인다.',
        timeCost: 1,
      },
      {
        text: '"너 너무 빡빡하게 하는 거 아냐?"',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '유나가 잠깐 눈을 깜빡인다. "그런가? 근데 안 하면 좀 불안해서." 말끝이 작아진다.',
        timeCost: 1,
      },
    ],
  },

  // --- yuna 70 ---
  {
    id: 'yuna-perfect-smile',
    title: '칠판 옆 웃음',
    description: '수업 전 교실. 유나가 칠판에 쓴 글씨를 지우다 멈춘다.\n"너는… 맨날 웃으면서 다 하면 어때?"\n물음이 장난처럼 들리지만 눈은 장난이 아니다.\n"나도 가끔 그냥 아무것도 모르는 척 하고 싶어."',
    speakers: ['yuna'],
    location: 'classroom',
    background: 'classroom_elementary',
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 70 && s.year === 1;
    },
    choices: [
      {
        text: '"지금도 충분히 너야" — 말한다',
        effects: { mental: 3, social: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 4 }],
        message: '유나가 칠판 손잡이를 놓았다. "…고마워. 진짜." 말끝이 떨리다가 또 웃음으로 감춰진다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'growth',
          importance: 5,
          toneTag: 'breakthrough',
          recallText: '칠판 앞 유나, 웃음이 역할인 줄 알았던 순간.',
          npcIds: ['yuna'],
        },
      },
      {
        text: '"나도 가짜 웃음 있어" — 털어놓는다',
        effects: { mental: 2, social: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 5 }],
        message: '유나가 나를 봤다가 옆으로 시선을 돌린다. "그래? …우리 비슷하네." 칠판 지우개 가루가 햇살에 떠다닌다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'discovery',
          importance: 6,
          toneTag: 'warm',
          recallText: '지우개 가루 속에서 말한 가짜 웃음 이야기.',
          npcIds: ['yuna'],
        },
      },
      {
        text: '주제를 돌린다',
        effects: { social: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '유나가 "응 그럼 수업 들어가자" 하며 분필을 다시 집는다. 평소가 힘들어 보이는 날이 있다는 걸 그때 처음 알았다.',
        timeCost: 1,
      },
    ],
  },

  // --- yuna 90 ---
  {
    id: 'yuna-window-promise',
    title: '창문 옆 약속',
    description: '졸업을 앞둔 겨울, 유나가 빈 교실 창문에 손가락으로 작은 별을 그린다.\n"나 나중에도 계속 잘해야 할까? 그냥 나로 있어도 괜찮은 날이 올까?"',
    speakers: ['yuna'],
    location: 'classroom',
    background: 'classroom_elementary_winter',
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 90 && s.year === 1;
    },
    choices: [
      {
        text: '"너는 이미 충분히 너야"',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 3 }],
        message: '유나가 창문에 그린 별을 손바닥으로 지운다. "그 말, 오래 기억할 것 같아."',
        timeCost: 1,
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 7,
          toneTag: 'warm',
          recallText: '겨울 창문 앞에서 유나에게 충분하다고 말한 날.',
          npcIds: ['yuna'],
        },
      },
      {
        text: '대답 대신 창문에 별 하나를 더 그린다',
        effects: { social: 2, talent: 1, mental: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 2 }],
        message: '유나가 잠깐 멈췄다가, 옆자리 별 옆에 작은 점 하나를 더한다. 말 없는 답이라는 걸 둘 다 안다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'discovery',
          importance: 6,
          toneTag: 'resolve',
          recallText: '대답 대신 별 두 개가 나란히 남은 창문.',
          npcIds: ['yuna'],
        },
      },
    ],
  },

  // --- subin 30 ---
  {
    id: 'subin-reading-marathon',
    title: '독서 마라톤 종이',
    description: '도서코너 앞 게시판에 작은 종이가 붙어 있다.\n"이번 주 책 세 권 읽기"\n수빈이가 옆에서 말한다.\n"나도 할 건데, 너도 할래? 안 해도 되고."\n부담 없어 보이는 척하는 목소리가 오히려 수빈 같다.',
    speakers: ['subin'],
    location: 'library',
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 30 && s.year === 1;
    },
    choices: [
      {
        text: '"어떤 책?" — 관심을 보인다',
        effects: { academic: 1, social: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 2 }],
        message: '수빈이가 책등 세 권을 집어 준다. "이 중에 하나만 같이 읽어도 돼." 표지가 손에 닿는 감촉이 이상하게 고맙다.',
        timeCost: 1,
      },
      {
        text: '"바쁜데… 다음에" — 미룬다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 1 }],
        message: '수빈이가 "그래, 무리하지 마. 나 혼자 읽고 괜찮은 거 있으면 알려줄게" 하고 책등을 다시 꽂아 둔다. 부담 없는 호의가 한 줄 남는다.',
        timeCost: 1,
      },
    ],
  },

  // --- subin 50 ---
  {
    id: 'subin-keychain',
    title: '책갈피 대신 열쇠고리',
    description: '점심 후 복도. 수빈이가 작은 열쇠고리를 꺼낸다.\n"엄마가 과일 사 오실 때 마트에서 주던 거… 나 하나 남았어."\n손바닥에 올려준다.\n"책갈피 대신 써도 되고, 그냥 가지고 있어도 돼."',
    speakers: ['subin'],
    location: 'hallway',
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 50 && s.year === 1;
    },
    choices: [
      {
        text: '고맙다고 받는다',
        effects: { mental: 2, social: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 3 }],
        message: '수빈이가 "잘 쓸 거지?" 하고 웃는다. 열쇠고리가 가벼운데 주머니 한쪽은 왠지 무겁다.',
        timeCost: 1,
      },
      {
        text: '"너는?" — 돌려줄까 망설인다',
        effects: { social: 1, mental: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 2 }],
        message: '수빈이가 손을 저었다. "나는 또 생겨. 엄마가 자주 그 마트 가거든." 말끝이 잠깐 가벼워졌다가 다시 조용해진다.',
        timeCost: 1,
      },
    ],
  },

  // --- subin 70 ---
  {
    id: 'subin-night-light',
    title: '늦은 밤 불빛 얘기',
    description: '단톡 창이 밤늦게 떴다. 수빈이다.\n"너 아직 깨어 있어? …괜찮으면 잠깐만."\n잠깐 뒤 메시지가 이어진다.\n"우리 집 거실 불, 밤새 켜두는 날이 있어. 그냥."',
    speakers: ['subin'],
    location: 'home',
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 70 && s.year === 1;
    },
    choices: [
      {
        text: '"나도 가끔 불 켜고 자" — 맞장구친다',
        effects: { mental: 2, social: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 4 }],
        message: '답장이 늦게 왔다. "…그렇구나. 나만 그런 줄 알았어." 이모티콘 하나 없는 대화가 이상하게 따뜻하다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'unspoken_debt',
          importance: 5,
          toneTag: 'warm',
          recallText: '거실 불 켜둔다는 단톡, 수빈이의 밤.',
          npcIds: ['subin'],
        },
      },
      {
        text: '"힘들면 내일 학교에서 말해" — 적는다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 5 }],
        message: '"응. 오늘은… 이걸로 됐어." 수빈이가 마지막에 작은 하트 하나만 보냈다. 잠이 오는 속도가 조금 달라진다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'growth',
          importance: 6,
          toneTag: 'resolve',
          recallText: '밤 단톡 끝에 왔던 작은 하트 하나.',
          npcIds: ['subin'],
        },
      },
      {
        text: '읽씹하지 않고 이모티콘만 보낸다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 1 }],
        message: '수빈이가 "ㅋㅋ 고마워" 하고 잤다는 메시지를 남겼다. 말이 많지 않아도 된다는 걸 배운 밤이다.',
        timeCost: 1,
      },
    ],
  },

  // --- subin 90 ---
  {
    id: 'subin-paper-airplane',
    title: '종이비행기',
    description: '졸업 전날, 수빈이가 빈 교실에서 종이비행기를 접고 있다.\n"멀리 날아가면 좋겠다. 어디든 갈 수 있는 것처럼."\n비행기 날개에는 작은 글씨로 이름 두 개와, 수빈이가 좋아하던 책에서 베꼈을 한 줄이 함께 적혀 있다.',
    speakers: ['subin'],
    location: 'classroom',
    background: 'classroom_elementary_winter',
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 90 && s.year === 1;
    },
    choices: [
      {
        text: '"같이 날려보자"',
        effects: { social: 2, talent: 1, mental: 3 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 3 }],
        message: '종이비행기가 교실 앞문까지 미끄러진다. 수빈이가 "생각보다 멀리 갔다" 하고 오래 바라본다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'growth',
          importance: 7,
          toneTag: 'warm',
          recallText: '졸업 전날 수빈이와 종이비행기를 날린 교실.',
          npcIds: ['subin'],
        },
      },
      {
        text: '"날개에 내 이름도 써도 돼?"',
        effects: { social: 3, mental: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 2 }],
        message: '수빈이가 연필을 건넨다. 두 이름이 나란히 적힌 비행기가 책상 위에서 잠깐 쉬고 있다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'discovery',
          importance: 6,
          toneTag: 'warm',
          recallText: '종이비행기 날개에 나란히 적힌 두 이름.',
          npcIds: ['subin'],
        },
      },
    ],
  },

  // --- doyun 40 (보강: Y1 종료 후 멀어지므로 다른 NPC 50 슬롯보다 임계값 낮춤) ---
  {
    id: 'doyun-secret-spot',
    title: '운동장 스탠드 뒤편',
    description: '도윤이가 조용히 손짓해.\n"야, 여기 와봐. 여기 앉아서 보면 하늘이 진짜 잘 보여. 선생님들도 몰라."',
    speakers: ['doyun'],
    location: 'gym',
    condition: (s) => {
      const doyun = s.npcs.find(n => n.id === 'doyun');
      return !!doyun?.met && doyun.intimacy >= 40 && s.year === 1;
    },
    choices: [
      {
        text: '나란히 앉아 구름의 모양을 맞춘다',
        effects: { mental: 2, social: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 5 }],
        message: '"저건 축구공 모양인데? 야, 넌 먹는 것만 생각하냐?" 도윤이가 웃자 그늘 안 공기가 같이 흔들린다.',
        timeCost: 1,
      },
      {
        text: '"여기 어떻게 알았어?" — 묻는다',
        effects: { social: 2, mental: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 3 }],
        message: '도윤이가 어깨를 으쓱한다. "그냥. 가끔 조용한 데가 필요해서." 한 박자 늦게 덧붙인다. "오늘은 같이 있어도 뭐."',
        timeCost: 1,
      },
    ],
  },

  // --- doyun 60 (보강: Y1 종료 후 멀어지므로 다른 NPC 70 슬롯보다 임계값 낮춤) ---
  {
    id: 'doyun-window-school',
    title: '창문 너머 말',
    description: '방과 후 교실이 시끄럽다.\n도윤이는 창가에 기대어 밖을 본다.\n"…저기 멀리 학교 하나 더 있지?"\n물어보는 사람처럼 말하는데, 답을 원하는 얼굴은 아니다.',
    speakers: ['doyun'],
    location: 'classroom',
    background: 'classroom_elementary',
    condition: (s) => {
      const doyun = s.npcs.find(n => n.id === 'doyun');
      return !!doyun?.met && doyun.intimacy >= 60 && s.year === 1;
    },
    choices: [
      {
        text: '"들었어" — 짧게 말한다',
        effects: { mental: 2, social: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 4 }],
        message: '도윤이가 고개를 끄덕이고 창문에 손을 댄다. 유리가 따뜻해서 김이 서린다. "말 안 해도 된다"는 뜻이 통한 것 같아서, 마음이 조금 내려앉는다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'unspoken_debt',
          importance: 5,
          toneTag: 'resolve',
          recallText: '창문 너머 낯선 학교 이야기, 도윤이 손끝에 남은 김이었던 날.',
          npcIds: ['doyun'],
        },
      },
      {
        text: '"아직 여기잖아" — 지금만 말한다',
        effects: { social: 1, mental: 3 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 5 }],
        message: '도윤이가 작게 웃었다. "…그래, 지금." 그 한마디가 지금만 잡아주는 것 같아서, 마음이 잠깐 따뜻해진다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 6,
          toneTag: 'warm',
          recallText: '도윤이가 "지금"이라고만 했던 창가의 그 오후.',
          npcIds: ['doyun'],
        },
      },
      {
        text: '모른 척 칠판 쪽으로 눈을 돌린다',
        effects: { academic: 1, mental: -1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 1 }],
        message: '도윤이도 더 이상 말하지 않았다. 시끄러움 속에서만 서로의 간격이 조금 벌어진 느낌이 들었다.',
        timeCost: 1,
      },
    ],
  },

  // --- minjae 70 ---
  {
    id: 'minjae-crumbled-note',
    title: '구겨진 만점',
    description: '교실 구석. 민재가 책상 서랍을 열었다 닫는다.\n손 안에는 말없이 구겨진 쪽지 하나.\n"…별거 아니야."\n말끝을 잘라 버리는 게 별거 같다는 걸 알고 있어서 더 말이 안 나온다.',
    speakers: ['minjae'],
    location: 'classroom',
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 70 && s.year === 1;
    },
    choices: [
      {
        text: '말없이 옆에 선다',
        effects: { mental: 2, social: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 4 }],
        message: '민재가 한참 만에 "실수하면 안 된대" 하고 낮게 말했다. 부모 얘기인지 스스로 얘기인지 구분이 안 간다. 구겨진 종이만 조금 펴진다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'growth',
          importance: 5,
          toneTag: 'regret',
          recallText: '구겨진 만점 쪽지, 민재 손바닥 안에서.',
          npcIds: ['minjae'],
        },
      },
      {
        text: '"나한텐 그게 별거 같아" — 말한다',
        effects: { social: 2, mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 5 }],
        message: '민재가 나를 봤다가 시선을 내린다. "…바보처럼 보이지?" 묻는데 답이 필요한 질문은 아니다. 창밖에서는 종소리만 멀게 들린다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'discovery',
          importance: 6,
          toneTag: 'breakthrough',
          recallText: '별거 아니라던 말이 별거였던 교실 구석.',
          npcIds: ['minjae'],
        },
      },
      {
        text: '"다른 애들한테도 잘하잖아" — 분위기 돌린다',
        effects: { social: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '민재가 억지로 웃었다. "그런가." 웃음이 얇아서 오히려 마음이 더 쓰인다.',
        timeCost: 1,
      },
    ],
  },
];

// ===== 학교생활 랜덤 이벤트 풀 (매주 1개씩 발생) =====
const SCHOOL_LIFE_EVENTS: GameEvent[] = [
  {
    id: 'random-quiz', title: '깜짝 퀴즈!',
    description: '선생님이 갑자기 "자, 퀴즈 보자" 하셨다.\n교실이 술렁인다.',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    choices: [
      { text: '자신 있게 풀어본다', effects: { academic: 2, mental: 1 }, message: '대부분 맞혔다! 선생님이 "역시" 하며 웃으셨다.' },
      { text: '찍기의 신이 되어본다', effects: { academic: 1, mental: -1 }, message: '반은 맞고 반은 틀렸다. 아슬아슬했다.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'friend-snack', title: '간식 나눠먹기',
    description: '쉬는 시간에 민재가 편의점 봉지를 꺼냈다.\n"이거 먹을래? 아까 사 온 건데."',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    speakers: ['minjae'],
    choices: [
      { text: '고맙게 받아 먹는다', effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '맛있다. 민재가 의외로 이런 건 잘 챙긴다.' },
      { text: '"괜찮아, 고마워" — 거절한다', effects: {}, message: '"그래? 알겠어." 민재가 담담하게 넘겼다.' },
    ],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !s.isVacation && !!minjae?.met;
    },
  },
  {
    id: 'class-prank', title: '교실 장난',
    description: '수업 중에 뒤에서 종이 비행기가 날아왔다.\n선생님은 못 보신 것 같다.',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    choices: [
      { text: '웃으며 무시한다', effects: { mental: 1 }, message: '웃음을 참느라 힘들었다. 그래도 수업은 들었다.' },
      { text: '같이 보내본다 (몰래)', effects: { social: 2, mental: 2, academic: -1 }, message: '같이 장난치다 수업을 날렸다. 하지만 재밌었다!' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'rain-day', title: '비 오는 날',
    description: '우산을 안 가져왔는데 비가 온다.\n교문 앞에서 멈칫한다.',
    location: 'school_gate',
    background: 'school_gate_{school}_rain',
    choices: [
      { text: '그냥 뛰어간다!', effects: { health: -1, mental: 1 }, message: '흠뻑 젖었지만 왠지 상쾌하다.' },
      { text: '편의점에서 우산을 산다', effects: {}, moneyEffect: -1, message: '편의점 비닐 우산. 어른이 된 기분.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'lost-eraser', title: '지우개의 행방',
    description: '시험 중에 지우개가 바닥에 떨어졌다.\n옆자리 아이가 자기 거를 반으로 잘라 준다.',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    choices: [
      { text: '"고마워!" — 감동받는다', effects: { social: 1, mental: 2 }, message: '작은 친절이 큰 감동이 됐다. 시험도 잘 본 것 같다.' },
      { text: '안 쓰고 그냥 시험 본다 (자존심)', effects: { academic: -1, mental: -1 }, message: '지우개 없이 시험 봤다. 아... 실수 고칠 걸.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'teacher-praise', title: '선생님의 칭찬',
    description: '오늘 수업 시간에 발표를 했는데 선생님이 크게 칭찬해주셨다.\n"와, 정말 잘했다!"',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    choices: [
      { text: '기분 좋게 받아들인다', effects: { mental: 3, academic: 1 }, message: '얼굴이 빨개졌지만 기분은 좋다. 자신감이 생겼다.' },
      { text: '부끄러워서 작아진다', effects: { mental: 1 }, message: '칭찬은 좋은데... 다들 쳐다보니 부끄럽다.' },
    ],
    condition: (s) => s.stats.academic >= 40 && !s.isVacation,
  },
  {
    id: 'group-project', title: '조별 과제',
    description: '선생님이 조별 과제를 내셨다.\n"한 달 안에 제출해야 합니다."',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    choices: [
      { text: '리더를 맡는다', effects: { social: 2, academic: 2, mental: -2 }, fatigueEffect: 3, message: '힘들지만 뿌듯하다. 조원들이 고마워했다.' },
      { text: '맡은 부분만 열심히 한다', effects: { academic: 2, mental: 1 }, message: '내 할 일은 끝냈다. 편하다.' },
      { text: '대충 한다...', effects: { social: -2 }, message: '조원들 눈치가 좀 그렇다...', },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'sick-day', title: '컨디션 난조',
    description: '이불 속에서 눈을 떴는데 머리가 아프고 열이 나는 것 같다.\n"오늘 쉴까..."',
    location: 'home',
    background: 'bedroom_night',
    choices: [
      { text: '참고 학교 간다', effects: { academic: 1, health: -2 }, fatigueEffect: 5, message: '억지로 갔는데 수업 내내 고통이었다.' },
      { text: '하루 쉰다', effects: { health: 1, mental: 1 }, fatigueEffect: -8, message: '푹 쉬고 나니 한결 나아졌다.' },
    ],
    condition: (s) => s.fatigue >= 40 && !s.isVacation,
  },
  {
    id: 'found-money', title: '길에서 만원',
    description: '등굣길에 만원짜리를 주웠다.\n주변에 떨어뜨린 사람이 안 보인다.',
    location: 'street',
    background: 'school_road_morning',
    condition: (s) => !s.isVacation,
    choices: [
      { text: '경찰서에 맡긴다', effects: { mental: 3 }, message: '착한 일 했다. 마음이 뿌듯하다.' },
      { text: '...주머니에 넣는다', effects: { mental: -2 }, moneyEffect: 1, message: '돈은 생겼는데 찝찝하다.' },
    ],
  },
  {
    id: 'pe-class-hero', title: '체육 시간의 영웅',
    description: '체육 시간에 피구를 하는데, 상대편 에이스가 공을 던졌다!',
    location: 'gym',
    background: 'gymnasium',
    choices: [
      { text: '멋지게 잡아본다!', effects: { health: 2, social: 3, mental: 2 }, message: '잡았다!! 반 전체가 환호했다. 오늘 영웅이다!' },
      { text: '피한다 (안전제일)', effects: { health: 1 }, message: '무사히 살아남았다. 뭐, 이것도 전략이지.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'study-cafe', title: '스터디 카페',
    description: '시험 기간이라 스터디 카페가 만석이다.\n겨우 자리를 잡았는데 옆에 수빈이가 앉아 있다!',
    location: 'cafe',
    background: 'cafe_study',
    speakers: ['subin'],
    // 시험 직전 주 또는 시험 주에만 발동 — "시험 기간이라 만석" 본문과 정합 (중·고만)
    condition: (s) => !s.isVacation && s.year >= 2
      && isExamPeriod(s.year, s.week)
      && !!s.npcs.find(n => n.id === 'subin')?.met,
    choices: [
      { text: '수빈이랑 같이 공부한다', effects: { academic: 2, social: 1 }, moneyEffect: -1,
        npcEffects: [{ npcId: 'subin', intimacyChange: 3 }],
        message: '수빈이랑 같이 하니까 집중이 잘 됐다. 모르는 거 서로 알려주면서.' },
      { text: '이어폰 끼고 혼자 집중한다', effects: { academic: 2, mental: 1 }, moneyEffect: -1, message: '나만의 시간. 효율적이었다. 수빈이가 살짝 아쉬운 표정을 지었다.' },
    ],
  },
  {
    id: 'social-media-drama', title: 'SNS 소동',
    description: '단톡방에서 누가 누구 험담을 했다가 들켰다.\n분위기가 험악해졌다.',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    choices: [
      { text: '중재를 시도한다', effects: { social: 3, mental: -1 }, message: '양쪽 이야기를 듣고 화해시켰다. 피곤하지만 뿌듯하다.' },
      { text: '안 끼어든다 (조용히 나간다)', effects: { mental: 1 }, message: '현명한 선택. 남의 싸움에 끼면 안 된다.' },
    ],
    condition: (s) => !s.isVacation && s.stats.social >= 20,
  },
  {
    id: 'sunset-walk', title: '노을이 예쁜 날',
    description: '방과후 집에 가는 길. 하늘이 유난히 예쁘다.\n발걸음이 느려진다.',
    location: 'street',
    background: 'sunset_walk',
    condition: (s) => !s.isVacation,
    choices: [
      { text: '사진 찍고 잠시 앉아있는다', effects: { mental: 4 }, message: '아무 생각 없이 하늘을 봤다. 마음이 편해졌다.' },
      { text: '빨리 집에 간다 (할 일이 많아)', effects: { academic: 1 }, message: '집에 와서 공부를 시작했다. 하늘이 좀 아쉽다.' },
    ],
  },
  {
    id: 'music-discovery', title: '새로운 노래',
    description: '유튜브에서 우연히 들은 노래가 너무 좋다.\n반복 재생이 멈추지 않는다.',
    location: 'home',
    background: 'bedroom_night',
    choices: [
      { text: '공부하면서 계속 듣는다', effects: { mental: 2, talent: 1 }, message: '좋은 음악과 함께하니 공부도 즐겁다.' },
      { text: '친구에게 공유한다', effects: { social: 2, mental: 1 }, message: '"이거 들어봐!" 친구도 좋아했다. 취향이 통하는 건 기분 좋다.' },
    ],
  },
  {
    id: 'cleaning-duty', title: '청소 당번',
    description: '오늘 청소 당번이다.\n교실이 엉망이다...',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    choices: [
      { text: '열심히 한다', effects: { health: 1, mental: 1 }, fatigueEffect: 2, message: '깨끗해진 교실을 보니 뿌듯하다.' },
      { text: '대충 하고 빠진다', effects: { social: -1 }, message: '옆에서 열심히 하는 애가 좀 미안하다.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'dream-question', title: '꿈이 뭐야?',
    description: '수업 시간에 선생님이 물었다.\n"너희, 나중에 뭐 하고 싶어?"',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    choices: [
      { text: '"아직 잘 모르겠어요" — 솔직하게', effects: { mental: 1 }, message: '모른다고 하는 것도 용기다. 선생님이 "천천히 찾아봐" 하셨다.' },
      { text: '"공부 관련 일이요!" — 학업형', effects: { academic: 1, mental: 1 }, message: '말하고 보니 진짜 그런 것 같기도 하다.' },
      { text: '"뭔가 만드는 일이요!" — 재능형', effects: { talent: 1, mental: 2 }, message: '선생님이 "좋은 꿈이네" 하며 웃으셨다.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'late-to-school', title: '지각!',
    description: '알람을 못 듣고 늦잠을 잤다!\n학교까지 전력 질주 중...',
    location: 'street',
    background: 'school_road_morning',
    choices: [
      { text: '뛰어간다!!!', effects: { health: 1 }, fatigueEffect: 3, message: '겨우 수업 시작 전에 도착했다. 심장이 터질 것 같다.' },
      { text: '포기하고 천천히 간다', effects: { mental: -1 }, message: '선생님한테 혼났다. 오늘 하루가 우울하다.' },
    ],
    condition: (s) => s.fatigue >= 30 && !s.isVacation,
  },
];

// 실제 반장(반장선거 당선) 여부 체크 — 반장 전용 이벤트 조건에 사용
// 현재 연도 기준 반장 여부 — 매년 선거가 새로 열리므로 같은 해 당선만 카운트
function isClassPresident(s: GameState): boolean {
  return s.events.some(e =>
    (e.id === 'class-president-win' || e.id === 'class-president-2-win')
    && e.year === s.year
    && e.resolvedChoice !== undefined
  );
}

// 반장/부반장 포함 학급 임원 여부 체크 — 같은 해 기준
function isClassOfficer(s: GameState): boolean {
  return isClassPresident(s)
    || s.events.some(e => e.id === 'class-president-nudge' && e.year === s.year && e.resolvedChoice === 0)
    || s.events.some(e => e.id === 'class-president-vice' && e.year === s.year && e.resolvedChoice === 0);
}

// 고정 주차 이벤트 해결 후 followup 이벤트 가져오기 (주당 1회 제한)
// ANNUAL_EVENT_IDS에 등록된 후속(반장 선거 후속 등)은 매년 재발동 허용
export function getFollowupForWeek(state: GameState, excludeLocation?: string): GameEvent | null {
  return GAME_EVENTS.find(e =>
    FOLLOWUP_EVENT_IDS.has(e.id) &&
    e.condition && e.condition(state) &&
    (ANNUAL_EVENT_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id)) &&
    // 같은 장소 이벤트 연쇄 방지 (농구→축구 같은 어색한 연결 차단)
    // DIRECT_SEQUEL_IDS는 자연스러운 직접 후속이라 같은 장소도 허용 (선거→결과 등)
    (!excludeLocation || e.location !== excludeLocation || DIRECT_SEQUEL_IDS.has(e.id))
  ) || null;
}

// 절대 주차 (학년 경계에서 음수가 안 나오도록) — 쿨다운 비교용
function weeksSince(state: GameState, prev: GameEvent): number {
  const curAbs = (state.year - 1) * 48 + state.week;
  const prevAbs = ((prev.year ?? state.year) - 1) * 48 + (prev.week ?? 0);
  return curAbs - prevAbs;
}

// conditional 이벤트 후보 필터링 — getEventForWeek 내부 + chain 픽(getConditionalForWeek)에서 공유
function pickConditionalCandidates(state: GameState): GameEvent[] {
  return GAME_EVENTS.filter(e =>
    !e.week &&
    e.condition &&
    e.condition(state) &&
    !FOLLOWUP_EVENT_IDS.has(e.id) &&
    !HARD_CRISIS_IDS.has(e.id) &&
    !SOFT_CRISIS_IDS.has(e.id) &&
    !state.events.some(prev => prev.id === e.id && weeksSince(state, prev) < 10)
  );
}

// E-2: 친밀도 도달형 자동 판별 — condition 함수 소스에서 npc.intimacy >= N 패턴 검사.
// 스토리 핵심 컷이라 일반 풀과 섞이지 않고 별도 풀로 우선 노출되도록 분리한다.
function isIntimacyMilestone(e: GameEvent): boolean {
  if (!e.condition) return false;
  return /\.intimacy\s*>=/.test(e.condition.toString());
}

// fixed/followup 이벤트 resolve 후 chain용 — conditional 이벤트 1개 추가 픽
// 같은 주(week+year)에 한 번만 호출되도록 호출자가 가드
export function getConditionalForWeek(state: GameState): GameEvent | null {
  const candidates = pickConditionalCandidates(state);
  if (candidates.length === 0) return null;

  // 친밀도 도달형 후보가 있으면 일반 풀과 섞지 않고 그중에서 무조건 1개 노출.
  // (도달형이 일반 이벤트와 1/N 경쟁해 묻히면 다음 노출까지 10주 쿨다운에 걸려 답답해진다.)
  const milestone = candidates.filter(isIntimacyMilestone);
  if (milestone.length > 0) {
    return milestone[Math.floor(seededRandom(state) * milestone.length)];
  }

  // 일반 조건부 풀: 기존 동작 유지 (50% 게이트)
  if (seededRandom(state) < 0.5) {
    return candidates[Math.floor(seededRandom(state) * candidates.length)];
  }
  return null;
}

// 옵션 C: chain cap 초과 시 milestone-only 추가 픽용. 일반 조건부는 픽하지 않는다.
// 학년 한정 도달형(예: Y1 한정)이 학년 마감 직전에 발동 못 하고 사라지는 문제 완화.
export function getMilestoneForWeek(state: GameState): GameEvent | null {
  const candidates = pickConditionalCandidates(state);
  const milestone = candidates.filter(isIntimacyMilestone);
  if (milestone.length === 0) return null;
  return milestone[Math.floor(seededRandom(state) * milestone.length)];
}

// 이번 주에 발동할 이벤트 가져오기
export function getEventForWeek(state: GameState): GameEvent | null {
  // 0. 고정 주차 이벤트 최우선 (followup보다 먼저 — 이미 발동한 이벤트 제외)
  // 같은 주에 여러 fixed 이벤트가 매칭될 수 있음 (예: W37의 단원평가 + 유나생일).
  // NPC 이벤트(speakers 보유)는 보통 친밀도/met 같은 추가 조건이 붙어 더 희소하므로 우선.
  // 학교 일정 이벤트는 매년 발동하지만, NPC 생일/관계 이벤트는 한 번 놓치면 끝이라
  // 후자가 우선되도록 stable 정렬.
  const fixedCandidates = GAME_EVENTS.filter(e =>
    e.week === state.week &&
    (!e.condition || e.condition(state)) &&
    (ANNUAL_EVENT_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id))
  );
  const fixedEvent = fixedCandidates.find(e => (e.speakers?.length ?? 0) > 0) ?? fixedCandidates[0];
  if (fixedEvent) return fixedEvent;

  // 1. 후속 이벤트 체크 (100% 발동) — ANNUAL은 매년 재발동 허용
  const followup = GAME_EVENTS.find(e =>
    FOLLOWUP_EVENT_IDS.has(e.id) &&
    e.condition && e.condition(state) &&
    (ANNUAL_EVENT_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id))
  );
  if (followup) return followup;

  // v1.2 (§4.3): 2. 하드 위기 — 연간 1회 가드 (state.hardCrisisYears)
  if (!state.hardCrisisYears.includes(state.year)) {
    const hardCrisis = GAME_EVENTS.find(e =>
      HARD_CRISIS_IDS.has(e.id) &&
      e.condition && e.condition(state) &&
      !state.events.some(prev => prev.id === e.id)
    );
    if (hardCrisis) {
      state.hardCrisisYears.push(state.year);
      return hardCrisis;
    }
  }

  // v1.2 (§4.3): 3. 소프트 위기 — 연간 2건 상한
  const softCrisisThisYear = state.events.filter(e =>
    e.year === state.year && SOFT_CRISIS_IDS.has(e.id)
  ).length;
  if (softCrisisThisYear < 2) {
    const softCrisis = GAME_EVENTS.find(e =>
      SOFT_CRISIS_IDS.has(e.id) &&
      e.condition && e.condition(state) &&
      !state.events.some(prev => prev.id === e.id)
    );
    if (softCrisis) return softCrisis;
  }

  // 4. 조건부 상태 이벤트 (피로/멘탈 등) — 50% 확률
  // 위기 ID는 위에서 이미 처리했으므로 중복 제거
  const conditionalEvents = pickConditionalCandidates(state);
  if (conditionalEvents.length > 0 && seededRandom(state) < 0.5) {
    return conditionalEvents[Math.floor(seededRandom(state) * conditionalEvents.length)];
  }

  // 5. 학교생활 랜덤 이벤트 — 70% 확률
  const availableSchoolEvents = SCHOOL_LIFE_EVENTS.filter(e =>
    (!e.condition || e.condition(state)) &&
    !state.events.some(prev => prev.id === e.id && weeksSince(state, prev) < 6)
  );
  if (availableSchoolEvents.length > 0 && seededRandom(state) < 0.7) {
    return availableSchoolEvents[Math.floor(seededRandom(state) * availableSchoolEvents.length)];
  }

  return null;
}
