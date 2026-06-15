import { GameEvent } from '../types';

export const REACH_EVENTS = [
  // ===== Phase 2.2: Y1 친밀도 도달형 이벤트 =====
  // 친밀도 게이트(30/50/70/90)로 5명 NPC를 Y1에 5개씩 균등화.
  // week 없음 + condition으로 도달 시 conditionalEvents 풀 진입 (1회성 자동 보장).
  // doyun 30 슬롯은 위쪽 doyun-comic-share 정비로 채움.
  // 주의: week가 없어 학기/방학 무관하게 conditional 풀에 진입한다. 학교 맥락(교실/복도/
  // 도서코너/운동장) 이벤트는 condition에 !s.isVacation 가드 필수 — 안 그러면 방학에 발동해
  // "방학인데 교실 문 앞" 같은 컨텍스트 desync 발생. 졸업(W41+) 겨울 이벤트와 집/단톡
  // 이벤트는 의도적으로 가드하지 않는다(각 condition 주석 참고).

  // --- yuna 30 ---
  {
    id: 'yuna-milk-duty',
    reach: { npc: 'yuna', tier: 30, year: 1 },
    title: '우유 당번',
    description: '아침 조회 전, 유나가 우유 상자를 들고 교실 문 앞에 서 있다.\n"나 혼자 들 수 있는데... 같이 들면 더 빨리 끝나긴 해." 밝게 말하지만 손끝이 조금 빨개져 있다.',
    speakers: ['yuna'],
    location: 'classroom',
    background: 'classroom_elementary_spring',
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 30 && s.year === 1 && !s.isVacation;
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
    reach: { npc: 'yuna', tier: 50, year: 1 },
    title: '별 스티커 계획표',
    description: '쉬는 시간, 유나 책상 위에 작은 계획표가 펼쳐져 있다.\n국어, 수학, 피아노 옆에 별 스티커가 빼곡하다.\n유나가 얼른 가리려다 멈춘다. "이거 좀 유치하지?"',
    speakers: ['yuna'],
    location: 'classroom',
    background: 'classroom_elementary',
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 50 && s.year === 1 && !s.isVacation;
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
    reach: { npc: 'yuna', tier: 70, year: 1 },
    title: '칠판 옆 웃음',
    description: '수업 전 교실. 유나가 칠판에 쓴 글씨를 지우다 멈춘다.\n"너는… 맨날 웃으면서 다 하면 어때?"\n물음이 장난처럼 들리지만 눈은 장난이 아니다.\n"나도 가끔 그냥 아무것도 모르는 척 하고 싶어."',
    speakers: ['yuna'],
    location: 'classroom',
    background: 'classroom_elementary',
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 70 && s.year === 1 && !s.isVacation;
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
    femaleChoices: [
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
        message: '유나가 픽 웃었다. "그래? …우리 비슷하네, 의외로." 칠판 지우개 가루가 햇살에 떠다닌다.',
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
    reach: { npc: 'yuna', tier: 90, year: 1 },
    title: '창문 옆 약속',
    description: '졸업을 앞둔 겨울, 유나가 빈 교실 창문에 손가락으로 작은 별을 그린다.\n"나 나중에도 계속 잘해야 할까? 그냥 나로 있어도 괜찮은 날이 올까?"',
    speakers: ['yuna'],
    location: 'classroom',
    background: 'classroom_elementary_winter',
    // 겨울(W41+) 게이트: 지문/배경/CG 모두 "졸업을 앞둔 겨울"로 고정 설계 →
    // 봄·여름에 발동하면 계절 desync. 졸업(W46) 포함 위해 vacation은 막지 않음.
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 90 && s.year === 1 && s.week >= 41;
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
    femaleChoices: [
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
        message: '유나가 픽 웃더니 옆에 작은 별을 하나 더 그린다. "우리 우정 기념. 촌스럽지?" 별 두 개가 나란히 남았다.',
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
    reach: { npc: 'subin', tier: 30, year: 1 },
    title: '독서 마라톤 종이',
    description: '도서코너 앞 게시판에 작은 종이가 붙어 있다.\n"이번 주 책 세 권 읽기"\n수빈이가 옆에서 말한다.\n"나도 할 건데, 너도 할래? 안 해도 되고."\n부담 없어 보이는 척하는 목소리가 오히려 수빈 같다.',
    speakers: ['subin'],
    location: 'library',
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 30 && s.year === 1 && !s.isVacation;
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
    reach: { npc: 'subin', tier: 50, year: 1 },
    title: '책갈피 대신 열쇠고리',
    description: '점심 후 복도. 수빈이가 작은 열쇠고리를 꺼낸다.\n"엄마가 과일 사 오실 때 마트에서 주던 거… 나 하나 남았어."\n손바닥에 올려준다.\n"책갈피 대신 써도 되고, 그냥 가지고 있어도 돼."',
    speakers: ['subin'],
    location: 'hallway',
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 50 && s.year === 1 && !s.isVacation;
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
    reach: { npc: 'subin', tier: 70, year: 1 },
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
    femaleChoices: [
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
        message: '"응. 오늘은… 이걸로 됐어." 수빈이가 짧게 고맙다는 말을 남기고 로그아웃했다. 친구 하나 다독인 밤이다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'growth',
          importance: 6,
          toneTag: 'resolve',
          recallText: '밤 단톡 끝, 친구를 다독인 짧은 인사.',
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
    reach: { npc: 'subin', tier: 90, year: 1 },
    title: '종이비행기',
    description: '졸업 전날, 수빈이가 빈 교실에서 종이비행기를 접고 있다.\n"멀리 날아가면 좋겠다. 어디든 갈 수 있는 것처럼."\n비행기 날개에는 작은 글씨로 이름 두 개와, 수빈이가 좋아하던 책에서 베꼈을 한 줄이 함께 적혀 있다.',
    femaleDescription: '졸업 전날, 수빈이가 빈 교실에서 종이비행기를 접고 있다.\n"멀리 날아가면 좋겠다. 어디든 갈 수 있는 것처럼."\n비행기 날개에는 작은 글씨로 가고 싶은 도시 이름들과, 수빈이가 좋아하던 책에서 베꼈을 한 줄이 적혀 있다.',
    speakers: ['subin'],
    location: 'classroom',
    background: 'classroom_elementary_winter',
    // 겨울(W41+) 게이트: 지문/배경/CG 모두 "졸업 전날"로 고정 설계 →
    // 봄·여름에 발동하면 계절 desync. 졸업(W46) 포함 위해 vacation은 막지 않음.
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 90 && s.year === 1 && s.week >= 41;
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
    femaleChoices: [
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
        text: '"우리 둘이 갈 도시도 적자"',
        effects: { social: 3, mental: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 2 }],
        message: '수빈이가 연필을 건넨다. 둘이 가고 싶은 도시 이름이 나란히 적힌 비행기가 책상 위에서 잠깐 쉬고 있다.',
        timeCost: 1,
        memorySlotDraft: {
          category: 'discovery',
          importance: 6,
          toneTag: 'warm',
          recallText: '종이비행기 날개에 나란히 적은 우리 꿈.',
          npcIds: ['subin'],
        },
      },
    ],
  },

  // --- doyun 40 (보강: Y1 종료 후 멀어지므로 다른 NPC 50 슬롯보다 임계값 낮춤) ---
  {
    id: 'doyun-secret-spot',
    reach: { npc: 'doyun', tier: 40, year: 1 },
    title: '운동장 스탠드 뒤편',
    description: '도윤이가 조용히 손짓해.\n"야, 여기 와봐. 여기 앉아서 보면 하늘이 진짜 잘 보여. 선생님들도 몰라."',
    speakers: ['doyun'],
    location: 'gym',
    condition: (s) => {
      const doyun = s.npcs.find(n => n.id === 'doyun');
      return !!doyun?.met && doyun.intimacy >= 40 && s.year === 1 && !s.isVacation;
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
    reach: { npc: 'doyun', tier: 60, year: 1 },
    title: '창문 너머 말',
    description: '방과 후 교실이 시끄럽다.\n도윤이는 창가에 기대어 밖을 본다.\n"…저기 멀리 학교 하나 더 있지?"\n물어보는 사람처럼 말하는데, 답을 원하는 얼굴은 아니다.',
    speakers: ['doyun'],
    location: 'classroom',
    background: 'classroom_elementary',
    condition: (s) => {
      const doyun = s.npcs.find(n => n.id === 'doyun');
      return !!doyun?.met && doyun.intimacy >= 60 && s.year === 1 && !s.isVacation;
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
    reach: { npc: 'minjae', tier: 70, year: 1 },
    title: '구겨진 만점',
    description: '교실 구석. 민재가 책상 서랍을 열었다 닫는다.\n손 안에는 말없이 구겨진 쪽지 하나.\n"…별거 아니야."\n말끝을 잘라 버리는 게 별거 같다는 걸 알고 있어서 더 말이 안 나온다.',
    speakers: ['minjae'],
    location: 'classroom',
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 70 && s.year === 1 && !s.isVacation;
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
] satisfies readonly GameEvent[];
