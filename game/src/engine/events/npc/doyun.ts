// 도윤은 다른 NPC 와 달리 학교 진입 영역(Y1 W4, W22, W47, Y2 W2) 에 분산되어 있어
// 원래 순서를 보존하려면 단일 array 가 아닌 5 sub-array 로 분리하고
// events/data.ts 에서 GAME_EVENTS 의 정확한 위치에 각각 spread 한다.
// (지훈/민재/유나/수빈 첫만남은 학교 첫날 컨텍스트와 강결합되어 school.ts 에 잔류)

import { GameEvent, GameState } from '../../types';

export const DOYUN_FIRST_MEET_M: GameEvent[] = [
  // ===== 도윤 첫 만남 — 남주 (Y1 W4) — 점심 축구 =====
  {
    id: 'doyun-meet-elementary',
    title: '운동장 한 명 모자라',
    description: '점심시간. 운동장 쪽에서 누가 손을 흔든다.\n같은 반 체육부장 박도윤. 축구공을 한 손으로 튕기며 가까이 온다.\n"야! 한 명 모자라는데, 너 들어올래? 너 발 빠르잖아."',
    week: 4,
    condition: (s: GameState) => s.year === 1 && s.gender === 'male',
    location: 'gym',
    background: 'gymnasium',
    speakers: ['doyun'],
    choices: [
      {
        text: '"좋아!" — 같이 뛴다',
        effects: { health: 2, social: 2, mental: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 5 }],
        message: '도윤이가 패스를 정확하게 줬다. 한 골 넣고 같이 웃었다. "너 진짜 들어와서 다행이야."',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '초6 봄, 도윤이가 던진 패스를 받아 처음 골을 넣은 점심.',
          npcIds: ['doyun'],
        },
      },
      {
        text: '"잠깐만, 가방만 두고 갈게"',
        effects: { social: 1, health: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 3 }],
        message: '교실에 가방 두고 운동장으로 뛰었다. 도윤이가 "왜 이렇게 늦어!" 하면서도 자리를 만들어줬다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 3,
          toneTag: 'warm',
          recallText: '가방 두러 가는 길이 괜히 빨라졌던 그 점심.',
          npcIds: ['doyun'],
        },
      },
      {
        text: '"오늘은 좀..." — 사양한다',
        effects: { mental: -1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 1 }],
        message: '"아 그래? 다음에 같이 하자!" 도윤이가 별로 신경 안 쓰는 표정으로 운동장 쪽으로 갔다. 이상하게 조금 아쉬웠다.',
      },
    ],
  },
];

export const DOYUN_FIRST_MEET_F: GameEvent[] = [
  // ===== 도윤 첫 만남 — 여주 (Y1 W4) — 청소시간 관찰 =====
  {
    id: 'doyun-meet-elementary-f',
    title: '청소시간',
    description: '청소시간. 양동이가 무겁다는 애한테 도윤이가 슥 다가간다.\n"내가 들게. 별것도 아니야."\n반 분위기가 살짝 풀어진다. 정리하던 도윤이 시선이 너에게 잠깐 와 닿더니, 살짝 웃는다.',
    week: 4,
    condition: (s: GameState) => s.year === 1 && s.gender === 'female',
    location: 'classroom',
    background: 'classroom_elementary',
    speakers: ['doyun'],
    choices: [
      {
        text: '"멋있다" — 솔직하게 말한다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 3 }],
        message: '도윤이가 "어, 별거 아닌데" 하면서도 어깨가 살짝 으쓱해졌다. 반에서 인기 있는 이유를 알 것 같다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '도윤이가 양동이를 들어주던 청소시간, 반 공기가 살짝 가벼워졌던 순간.',
          npcIds: ['doyun'],
        },
      },
      {
        text: '눈이 마주치자 살짝 웃어준다',
        effects: { mental: 2 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 2 }],
        message: '도윤이가 살짝 끄덕이고 다시 청소를 한다. 별 말 안 했는데 뭔가 통한 기분이다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 3,
          toneTag: 'warm',
          recallText: '교실 청소 끝, 도윤이와 마주친 짧은 눈빛 — 졸업앨범에 동그라미가 시작된 순간.',
          npcIds: ['doyun'],
        },
      },
      {
        text: '못 본 척 하던 청소를 계속한다',
        effects: { academic: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 1 }],
        message: '도윤이도 별 신경 안 쓴 듯 다른 애와 떠들며 갔다. 근데 왠지 그 뒷모습이 자꾸 눈에 들어온다.',
      },
    ],
  },
];

export const DOYUN_DAILY: GameEvent[] = [
  // ===== 도윤 일상 (Y1 W22) — 만화책 돌려보기 =====
  {
    id: 'doyun-comic-share',
    title: '쉬는 시간 만화책',
    description: '쉬는 시간. 도윤이가 책상 사이를 돌며 만화책을 한 권씩 돌리고 있다.\n반 애들이 "다음 권 누가 봐?" 하며 줄을 선다.\n도윤이가 너 앞에 서서 책을 쓱 내민다.\n"이거, 너 아직 안 봤지?"',
    // Phase 2.2: 고정 주차(W22) → 도달형(intimacy >= 30) 변환
    condition: (s: GameState) => {
      const doyun = s.npcs.find(n => n.id === 'doyun');
      return s.year === 1 && !!doyun?.met && doyun.intimacy >= 30;
    },
    location: 'classroom',
    background: 'classroom_elementary',
    speakers: ['doyun'],
    choices: [
      {
        text: '"오, 고마워!" — 받아 본다',
        effects: { mental: 2, social: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 2 }],
        message: '쉬는 시간이 짧아서 한 페이지밖에 못 봤는데, 도윤이가 "다 보면 다음 사람한테 넘겨줘" 하며 자연스럽게 다음 사람을 정해준다. 이 흐름이 도윤다웠다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 2,
          toneTag: 'warm',
          recallText: '도윤이가 돌리던 만화책, 내 차례가 왔던 어느 쉬는 시간.',
          npcIds: ['doyun'],
        },
      },
      {
        text: '"이거 봤어. 다음 사람 줘"',
        effects: { social: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 1 }],
        message: '도윤이가 "오, 빠르네. 그럼 다음 권 오면 네가 먼저 봐" 하며 칠판 한쪽 순번표에 내 이름을 슥 적어 놓는다.',
      },
    ],
  },
];

export const DOYUN_GRADUATION: GameEvent[] = [
  // ===== 도윤 졸업식 사인 (Y1 W47) — 같이 사인 교환 =====
  // 여주 분기는 거리감 호감 톤 (femaleDescription/femaleChoices) — W4 청소시간 관찰자 톤과 일관
  {
    id: 'doyun-graduation-sign',
    title: '졸업앨범 뒤에 사인',
    description: '졸업식 며칠 뒤. 학교에 잠깐 들렀다가 운동장에서 도윤이를 만났다.\n도윤이가 졸업앨범 한 권을 들고 다가온다.\n"야, 사인 하나 해줘. 나도 너 거 해줄게."\n매직펜을 손에 쥐어 준다.',
    week: 47,
    condition: (s: GameState) => {
      const doyun = s.npcs.find(n => n.id === 'doyun');
      return s.year === 1 && !!doyun?.met;
    },
    location: 'auditorium',
    background: 'auditorium_elementary',
    speakers: ['doyun'],
    choices: [
      {
        text: '"중학교 달라도 자주 보자" — 진심으로 적는다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 6 }],
        message: '도윤이가 "오 진짜? 약속이다!!!" 하며 자기 사인 옆에 작은 축구공을 그렸다. "나중에 만나면 모른 척하지 마라."',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 6,
          toneTag: 'warm',
          recallText: "졸업앨범 뒤에 도윤이가 그린 작은 축구공과 '모른 척하지 마라'.",
          npcIds: ['doyun'],
        },
      },
      {
        text: '장난스럽게 짧게 적는다',
        effects: { social: 1, mental: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 3 }],
        message: '"야 이게 뭐야!!!" 도윤이가 웃으면서 똑같이 짧게 적었다. 둘 다 이게 마지막인 줄 모르는 척.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '둘 다 짧게 적은 졸업 사인, 그땐 가벼운 줄 알았다.',
          npcIds: ['doyun'],
        },
      },
      {
        text: '뭐라고 적을지 한참 고민하다 평범하게 마무리',
        effects: { mental: -1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 1 }],
        message: '"잘 지내" 정도로 적었다. 도윤이도 비슷하게 적었다. 그게 어떤 뜻인지는 그때 몰랐다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 4,
          toneTag: 'regret',
          recallText: "'잘 지내' 한마디로 마무리한 졸업 사인 — 그때 더 적었어야 했다.",
          npcIds: ['doyun'],
        },
      },
    ],
    // 여자 버전: 거리감 호감 톤 — 무리에 둘러싸여 있던 도윤이가 너에게만 잠깐 와서 부탁하는 결
    femaleDescription: '졸업식 며칠 뒤. 학교에 잠깐 들렀다가 운동장에서 도윤이를 마주쳤다.\n무리에 둘러싸여 있던 도윤이가 졸업앨범 한 권을 든 채 너 쪽으로 슬쩍 다가온다.\n"...사인, 한 줄만 해줄래?"\n매직펜이 너에게 건네진다.',
    femaleChoices: [
      {
        text: '잠깐 펜을 멈췄다가, 한 줄 진심으로 적는다',
        effects: { mental: 3, social: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 4 }],
        message: '"중학교 가서도, 잘 지내" 정도로 적었다. 도윤이가 페이지를 살짝 보더니 "...너답다" 하고 자기 것도 짧게 적어줬다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 5,
          toneTag: 'warm',
          recallText: "졸업앨범 끝, 도윤이가 작게 '너답다' 했던 한순간.",
          npcIds: ['doyun'],
        },
      },
      {
        text: '살짝 웃고 짧게 한 줄 적는다',
        effects: { social: 1, mental: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 2 }],
        message: '도윤이도 별 말 없이 짧게 적었다. 페이지를 닫는 손이 평소보다 조심스러웠다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '말없이 짧게 적은 사인, 그날만 평소보다 조용하던 도윤.',
          npcIds: ['doyun'],
        },
      },
      {
        text: '"...뭐 적지" 하다가 평범하게 마무리',
        effects: { mental: -1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: 1 }],
        message: '결국 "잘 지내" 정도로 끝냈다. 도윤이도 비슷하게 적었다. 그게 어떤 뜻인지는 그땐 몰랐다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 4,
          toneTag: 'regret',
          recallText: "'잘 지내' 한마디로 끝낸 졸업 사인 — 더 적었어야 했다는 후회.",
          npcIds: ['doyun'],
        },
      },
    ],
  },
];

export const DOYUN_SCHOOL_SPLIT: GameEvent[] = [
  // ===== 도윤 학군 이사 (Y2 W2) — 첫 관계 상실 =====
  // 친밀도 변화량 (-8/-12/-15): 사용자 의도 "절반 하락"의 근사값.
  // 이벤트만으로 누적되는 평균 친밀도(~17~19) 기준으로 -20 이상이면 0 클램프에 부딪혀
  // "절반"이 아니라 "전부" 떨어지는 문제 → 보수화. multiplier 시스템은 SNS 채널 PR에서 도입.
  // 메모리 카테고리: 학군 이사는 외부 요인이므로 'betrayal'(서로 배신)이 아닌 'failure'/'discovery'(관계의 한계 학습)로 정렬.
  {
    id: 'doyun-school-split',
    title: '도윤이는 다른 학교',
    description: '입학 둘째 주. 카톡으로 도윤이한테서 메시지가 왔다.\n"야, 나 다른 중학교 가게 됐어. 학군 때문에 이사 가더라고. 미리 말 못해서 미안~~"\n읽고 한참을 가만히 있었다.',
    week: 2,
    condition: (s: GameState) => {
      const doyun = s.npcs.find(n => n.id === 'doyun');
      return s.year === 2 && !!doyun?.met && !s.events.some(e => e.id === 'doyun-school-split');
    },
    location: 'home',
    background: 'home_evening',
    speakers: ['doyun'],
    choices: [
      {
        text: '"야 진짜야? 우리 만나서 밥이라도 먹자" — 약속을 잡으려 한다',
        effects: { mental: -1, social: 1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: -8 }],
        message: '도윤이가 "오 진짜? 좋지!!!" 답했지만, 약속은 결국 잡히지 않았다. 학교가 다르면 시간이 안 맞는 게 이런 거구나.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 6,
          toneTag: 'regret',
          recallText: "'밥 먹자'고 보냈지만 결국 잡히지 않은 약속 — 학교가 다르면 시간도 다르단 걸 처음 배운 봄.",
          npcIds: ['doyun'],
        },
      },
      {
        text: '"잘 가" — 짧게 답한다',
        effects: { mental: -3 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: -12 }],
        message: '"응. 너도 잘 지내." 도윤이의 답도 짧았다. 그렇게 카톡 창이 닫혔다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 7,
          toneTag: 'regret',
          recallText: "'잘 가' 한마디로 끝낸 카톡, 더 적었어야 했다는 후회.",
          npcIds: ['doyun'],
        },
      },
      {
        text: '읽씹한다 — 뭐라고 답해야 할지 모르겠다',
        effects: { mental: -4, social: -1 },
        npcEffects: [{ npcId: 'doyun', intimacyChange: -15 }],
        message: '하루, 이틀, 일주일이 지나자 답할 수 없는 분위기가 됐다. 도윤이도 더는 묻지 않았다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 7,
          toneTag: 'regret',
          recallText: '도윤이의 마지막 카톡에 답하지 못한 채 흐려진 봄.',
          npcIds: ['doyun'],
        },
      },
    ],
  },
];
