import { GameEvent } from '../../types';

export const JUNHA_EVENTS = [
  // ===== 준하 이벤트 체인 (고2 전학생, 후반부 변수) =====
  {
    id: 'junha-transfer',
    title: '전학생이 왔다',
    description: '담임이 말한다. "전학생이다, 잘 지내라."\n키가 크고 좀 어색해 보이는 남자애가 서 있다.\n"안녕하세요, 송준하입니다. 부산에서 왔습니다."\n사투리가 살짝 섞여 있다.',
    // M5 Phase 3: FOLLOWUP_EVENT라 week 불필요
    location: 'classroom',
    background: 'classroom_{school}',
    speakers: ['junha'],
    condition: (s) => {
      const junha = s.npcs.find(n => n.id === 'junha');
      return s.year === 6 && !junha?.met && !s.isVacation;
    },
    choices: [
      // M5 Phase 3: 첫 만남 8→12 / 3→5 — decay 상쇄 + 후속 진입 문턱 보장
      { text: '"여기 앉아, 같이 밥 먹자" — 먼저 다가간다', effects: { social: 3, mental: 2 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 10 }],
        message: '준하가 살짝 놀란 표정을 지었다. "...고맙다. 서울 애들은 좀 무서울 줄 알았는데." 첫날 점심을 같이 먹었다.' },
      { text: '눈인사만 한다', effects: {},
        npcEffects: [{ npcId: 'junha', intimacyChange: 3 }],
        message: '준하가 점심시간에 혼자 주먹밥을 꺼내 먹고 있었다. 낡은 도시락통이 눈에 들어왔다.' },
    ],
  },
  {
    id: 'junha-riceball',
    title: '준하의 주먹밥',
    description: '점심시간. 준하가 다가와서 도시락통을 내밀었다.\n"이거 어제 만들어 봤는데, 먹어봐."\n안에 주먹밥이 가지런히 놓여 있다.',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    speakers: ['junha'],
    // M5 Phase 3: intimacy 15→8 완화
    condition: (s) => {
      const junha = s.npcs.find(n => n.id === 'junha');
      return !!junha?.met && junha.intimacy >= 8 && s.year >= 6 && !s.isVacation;
    },
    choices: [
      { text: '"이거 네가 만든 거야? 맛있는데!" — 감탄한다', effects: { mental: 3, health: 1 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 5 }],
        message: '준하 얼굴이 환해졌다. "진짜? 참치마요 넣었거든. 나 이거 좀 자신 있어." 말하는 표정이 지금까지 본 것 중 제일 밝다.' },
      { text: '"고마워, 잘 먹을게" — 조용히 받는다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 2 }],
        message: '맛있다. 집에서 만든 느낌이 난다. 준하가 반응을 기다리는 눈치다. "...맛있어." 준하 얼굴이 환해졌다. "그렇지?"' },
    ],
  },
  {
    id: 'junha-dialect',
    title: '사투리가 나왔다',
    description: '체육 시간, 축구를 하다가 준하가 흥분했다.\n"아이고 마! 야 빨리 패스해라!!"\n체육관이 조용해졌다가 웃음이 터졌다.\n준하 얼굴이 빨개졌다.',
    femaleDescription: '체육 시간, 피구를 하다가 준하가 흥분했다.\n"아이고 마! 피해라!!"\n체육관이 조용해졌다가 웃음이 터졌다.\n준하 얼굴이 빨개졌다.',
    location: 'gym',
    background: 'gymnasium',
    speakers: ['junha'],
    // M5 Phase 3: intimacy 30→20 완화
    condition: (s) => {
      const junha = s.npcs.find(n => n.id === 'junha');
      return !!junha?.met && junha.intimacy >= 20 && s.year >= 6 && !s.isVacation;
    },
    choices: [
      { text: '"사투리 멋있는데? 원래 말투가 더 낫다" — 편하게 말한다', effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 6 }],
        message: '준하가 멈칫했다가 웃었다. "...진짜? 여기서 사투리 쓰면 좀 눈치 보여서." "신경 쓰지 마." "야 뭐라카노!" 같이 웃었다.' },
      { text: '같이 웃는다 — 자연스럽게 넘긴다', effects: { social: 1 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 2 }],
        message: '준하가 "아 진짜..." 하면서 머리를 긁었다. 분위기는 나쁘지 않았다. 오히려 반 분위기가 좀 풀렸다.' },
      { text: '"부산 사람 맞네" — 놀린다', effects: { social: -1 },
        npcEffects: [{ npcId: 'junha', intimacyChange: -2 }],
        message: '준하가 웃긴 했는데 눈이 안 웃었다. "...서울 애들은 꼭 그러더라." 괜히 미안해졌다.' },
    ],
  },
  {
    id: 'junha-homesick',
    title: '부산 단톡방',
    description: '밤에 카톡이 왔다. 준하다.\n"나 부산 친구들 단톡방 나왔어."\n"왜?"\n"대화에 못 끼겠더라. 걔들은 걔들 세계가 있고... 나는 여기도 저기도 아닌 것 같아."',
    location: 'home',
    background: 'bedroom_night',
    speakers: ['junha'],
    // M5 Phase 3: intimacy 50→35 완화
    condition: (s) => {
      const junha = s.npcs.find(n => n.id === 'junha');
      return !!junha?.met && junha.intimacy >= 35 && s.year >= 6 && !s.isVacation;
    },
    choices: [
      { text: '"여기에 네 자리 있잖아" — 위로한다', effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 6 }],
        message: '한참 뒤에 답이 왔다. "...고맙다. 서울 와서 이런 말 처음 들었다." 그 뒤로 준하가 좀 더 편해진 것 같다.' },
      { text: '"새 친구 있잖아, 여기서 만든 거" — 격려한다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 4 }],
        message: '"...맞나?" 잠깐 뒤에 "맞는 것 같기도 하다" 답이 왔다. 이모티콘 하나. 그래도 좀 나아 보인다.' },
      { text: '그냥 들어준다', effects: { mental: 1 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 3 }],
        message: '한참 동안 대화가 이어졌다. 부산 이야기, 친구 이야기, 전학 이야기. 마지막에 "들어줘서 고맙다" 했다.' },
    ],
  },
  {
    id: 'junha-cook',
    title: '요리사의 꿈',
    description: '점심시간, 준하가 옥상으로 불렀다.\n오늘도 직접 만든 도시락을 꺼낸다.\n"나 요리사 될 거야."\n"엄마가 식당에서 일하는 거 보면서... 음식이 사람을 편하게 만든다고 느꼈어."',
    location: 'rooftop',
    background: 'rooftop',
    speakers: ['junha'],
    // M5 Phase 3: intimacy 65→50 완화. QA C6: 50→38 — junha 집중 천장 ~42라 50이면 '요리사의 꿈'
    //   핵심 장면이 사장. 짧은 등장 윈도(Y6~7)에 맞춘 게이트 압축(talk tier 50/70/80→38/44/48과 정합).
    condition: (s) => {
      const junha = s.npcs.find(n => n.id === 'junha');
      return !!junha?.met && junha.intimacy >= 38 && s.year === 7 && s.week >= 8 && !s.isVacation;
    },
    choices: [
      { text: '"멋있다. 너한테 딱 맞는 것 같아" — 응원한다', effects: { social: 2, mental: 4 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 8 }],
        message: '준하가 웃었다. "진짜? 아빠는 뭔 요리사냐고 했는데... 엄마는 응원해줘." "네 주먹밥 먹어본 사람은 다 응원할걸." 준하가 주먹밥을 하나 더 건넸다. "이거 새 메뉴야. 먹어봐."',
        memorySlotDraft: { category: 'growth', importance: 7, toneTag: 'warm', recallText: '요리사가 되겠다는 준하에게, 다들 응원할 거라 했다.', npcIds: ['junha'] } },
      { text: '"대학은 어떻게 할 거야?" — 현실적으로 묻는다', effects: { mental: 1 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 2 }],
        message: '"조리학과 갈 거야. 수시는 힘들고 정시로." 준하가 담담하게 말했다. 이미 다 생각해둔 눈빛이었다.' },
      { text: '"언젠가 네 가게에 갈게" — 약속한다', effects: { social: 3, mental: 3 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 7 }],
        message: '준하가 잠깐 멈칫했다가 웃었다. "약속이다. 첫 번째 손님." 바람이 불었다. 옥상에서 먹는 주먹밥이 유난히 맛있었다.',
        memorySlotDraft: { category: 'reconciliation', importance: 7, toneTag: 'warm', recallText: '네 가게 첫 손님이 되겠다고, 옥상에서 약속했다.', npcIds: ['junha'] } },
    ],
  },
  // ===== 준하 x 민재 교차이벤트 =====
  {
    id: 'junha-minjae',
    title: '직설과 페르소나',
    description: '쉬는 시간. 준하가 민재에게 말을 걸었다.\n"야, 너 진짜 공부 안 하냐? 전교 1등이 공부 안 한다는 거 누가 믿어."\n교실이 살짝 조용해졌다. 민재가 웃는다.\n"진짜 안 했는데?"\n준하가 가만히 쳐다본다. "...거짓말하지 마."',
    location: 'classroom',
    background: 'classroom_{school}',
    speakers: ['junha', 'minjae'],
    condition: (s) => {
      const junha = s.npcs.find(n => n.id === 'junha');
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!junha?.met && !!minjae?.met && junha.intimacy >= 25 && minjae.intimacy >= 30
        && s.year >= 6 && !s.isVacation;
    },
    choices: [
      { text: '지켜본다 — 흥미롭다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 1 }, { npcId: 'minjae', intimacyChange: 1 }],
        message: '민재가 처음으로 말을 잃었다. 준하의 직설 앞에서 여유로운 척이 안 먹힌 거다. "...알겠어. 좀 한다." 민재가 웃으면서 인정했다. 교실 분위기가 묘하게 달라졌다.' },
      { text: '"준하 말이 맞긴 해" — 준하 편을 든다', effects: { social: 1 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 3 }, { npcId: 'minjae', intimacyChange: -1 }],
        message: '민재가 살짝 당황했다. "야, 너까지..." 준하가 "역시 내 말이 맞지" 했다. 민재가 한숨을 쉬었다. "...좀 하는 거 맞아."' },
      { text: '"민재는 원래 그래" — 민재를 감싸준다', effects: { social: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 2 }, { npcId: 'junha', intimacyChange: 1 }],
        message: '준하가 "그래? 서울 애들은 다 그런 건가" 했다. 민재가 고마운 듯 쳐다봤다. 하지만 준하의 말이 머릿속에 남았다.' },
    ],
  },
  {
    id: 'junha-birthday', title: '준하 생일',
    description: '오늘이 준하 생일이다.\n준하가 반 전체에 주먹밥을 싸왔다.\n"생일이라고 뭘 받으면 이상하잖아. 내가 해온 거 먹어."',
    week: 20,
    location: 'classroom', background: 'classroom_{school}_afternoon',
    speakers: ['junha'],
    condition: (s) => {
      const junha = s.npcs.find(n => n.id === 'junha');
      return !!junha?.met && junha.intimacy >= 10 && s.year >= 6;
    },
    choices: [
      { text: '"생일 축하해! 근데 생일인 사람이 왜 음식을 해와" — 웃으며 말한다', effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 6 }],
        message: '"부산에서는 원래 이래." 준하가 웃었다. 주먹밥이 정말 맛있었다. 반 애들이 "야, 매주 해와라" 했다.' },
      { text: '요리책 + 앞치마를 선물한다 (-5만원)', effects: { social: 3, mental: 4 }, moneyEffect: -5,
        npcEffects: [{ npcId: 'junha', intimacyChange: 10 }],
        message: '준하가 앞치마를 받아 들고 잠깐 말을 잃었다. "...니, 내 꿈 기억하고 있었나." 그 뒤로 복도에서 마주치면 먼저 웃어줬다.' },
      { text: '카톡으로 축하한다', effects: { social: 1 },
        npcEffects: [{ npcId: 'junha', intimacyChange: 1 }],
        message: '"고맙다~" 준하가 답장을 보냈다. 이모티콘이 부산 사투리였다.' },
    ],
  },
  {
    id: 'haeun-birthday', title: '하은 선배 생일',
    description: '오늘이 하은 선배 생일이다.\n카톡으로 축하 메시지를 보낼까?',
    week: 35,
    location: 'classroom', background: 'classroom_{school}_afternoon',
    speakers: ['haeun'],
    // M5 Phase 3-Y: intimacy 20→10 완화 (첫만남 직후에도 생일 참석 가능)
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return !!haeun?.met && haeun.intimacy >= 10
        && (s.year === 2 || s.year === 3 || (s.year >= 5 && s.events.some(e => e.id === 'haeun-reunion')));
    },
    choices: [
      { text: '직접 찾아가서 축하한다 (-1만원)', effects: { social: 2, mental: 3 }, moneyEffect: -1,
        npcEffects: [{ npcId: 'haeun', intimacyChange: 7 }],
        message: '"야, 어떻게 알았어?" 하은이가 웃었다. "후배가 이렇게까지 해주니까 감동인데?"' },
      { text: '꽃다발과 편지를 준비한다 (-5만원)', effects: { social: 3, mental: 5 }, moneyEffect: -5,
        npcEffects: [{ npcId: 'haeun', intimacyChange: 10 }],
        message: '하은이가 편지를 읽고 한참 아무 말 안 했다. "...야, 나 지금 울면 이상한 거야?" 눈이 빨개진 채로 웃었다.' },
      { text: '카톡으로 축하한다', effects: { social: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 1 }],
        message: '"고마워~ 넌 진짜 챙김이 남다르다?" 하은이가 답장을 보냈다.' },
    ],
  },
] satisfies readonly GameEvent[];
