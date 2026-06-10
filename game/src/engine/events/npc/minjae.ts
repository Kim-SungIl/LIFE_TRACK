import { GameEvent } from '../../types';

export const MINJAE_EVENTS = [
  // ===== 민재 이벤트 체인 =====
  {
    id: 'minjae-sports',
    title: '체육시간의 민재',
    description: '체육시간. 농구를 하는데 민재가 같은 팀이 됐다.\n민재가 공을 받자마자 두 명을 제치고 슛을 넣었다.\n조용한 모범생인 줄로만 알았는데, 운동 신경이 장난 아니다.',
    location: 'gym',
    background: 'gymnasium',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      // Y1 1학기 밀집 완화: 2학기로 이동 (원래 W4~W16 → W25~W40)
      return s.year === 1 && !!minjae?.met && !s.isVacation && s.week >= 25 && s.week <= 40;
    },
    choices: [
      {
        text: '"야, 운동도 잘하네!" — 하이파이브한다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '민재가 웃으며 손바닥을 쳤다. "농구는 좀 해." 의외의 모습이다. 공부만 하는 애가 아니었어.',
      },
      {
        text: '"같이 뛰자!" — 팀 플레이에 합류한다',
        effects: { health: 2, social: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '다음 공격에서 민재와 패스를 주고받다 깔끔하게 득점했다. "오, 손발 잘 맞는데?" 같은 팀이 되니 말이 트인다.',
      },
    ],
    femaleDescription: '체육시간. 배구를 하는데 민재가 옆 코트에서 뛰고 있다.\n공이 넘어왔는데 민재가 순식간에 잡아서 돌려줬다.\n조용한 모범생인 줄로만 알았는데, 운동 신경이 장난 아니다.',
    femaleChoices: [
      {
        text: '"야, 운동도 잘하네!" — 말을 건다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '민재가 웃으며 "배구도 좀 해" 했다. 의외의 모습이다. 공부만 하는 애가 아니었어.',
      },
      {
        text: '"고마워!" — 가볍게 인사한다',
        effects: { social: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '민재가 손을 흔들었다. 체육시간에 처음 말을 섞었다. 생각보다 편한 애다.',
      },
    ],
  },
  {
    id: 'minjae-exam-chat',
    title: '시험 결과',
    description: '시험 결과가 나왔다.\n민재 시험지를 슬쩍 봤는데 거의 다 100점이다.\n"야... 너 다 맞았어?"\n민재가 시험지를 뒤집으며 "이번엔 좀 쉬웠어" 하고 넘긴다.',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return s.year === 1 && !!minjae?.met && s.week === 17;
    },
    choices: [
      {
        text: '"와, 대단하다" — 솔직하게 감탄한다',
        effects: { social: 1, mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 2 }],
        message: '민재가 시험지를 가방에 넣으며 "뭐, 그냥 외운 거지" 했다. 대수롭지 않은 척하는데, 왠지 무리해서 웃는 것 같았다.',
      },
      {
        text: '"나도 다음엔 더 해봐야지" — 자극을 받는다',
        effects: { academic: 1, mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '민재가 잠깐 나를 봤다. "...같이 공부할래? 모르는 거 있으면 알려줄게." 의외로 친절한 면이 있다.',
      },
    ],
  },
  {
    id: 'minjae-birthday',
    title: '민재 생일',
    description: '오늘이 민재 생일이다.\n교실에서 누군가 "야 민재 생일이래!" 하고 외쳤다.\n민재가 살짝 당황하면서도 웃는다. "아, 뭐 별 거 아닌데..."',
    week: 7,
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && (s.year === 1 || minjae.intimacy >= 25);
    },
    choices: [
      {
        text: '"생일 축하해!" — 말을 건다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '민재가 살짝 놀란 표정이었다가 웃었다. "고마워." 의외로 수줍게 웃는다.',
      },
      {
        text: '편의점에서 작은 선물을 사온다 (-1만원)',
        effects: { social: 3, mental: 3 },
        moneyEffect: -1,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 5 }],
        message: '"이걸 왜... 아 고마워." 민재가 진짜로 기뻐하는 것 같다. 전교 1등도 생일 선물은 좋은가 보다.',
      },
      {
        text: '따로 골라 온 책 한 권을 준다 (-5만원)',
        // 책 한 권 정성 선물: 여유 있는 상태에서만 — 5만원만 있으면 다 털어 사는 느낌이라 부자연스러움
        condition: (s) => s.money >= 10,
        effects: { social: 3, mental: 4 },
        moneyEffect: -5,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 10 }],
        message: '민재가 책 제목을 한참 보더니 "...너, 날 너무 잘 아는데?" 처음으로 태연한 척이 완전히 벗겨진 순간이었다.',
      },
      {
        text: '그냥 넘어간다',
        effects: {},
        message: '민재 주변으로 축하하는 애들이 모였다. 나는 자리에서 지켜봤다.',
      },
    ],
  },
  {
    id: 'minjae-ranking',
    title: '성적표가 붙은 날',
    description: '중간고사 성적표가 복도에 붙었다.\n다들 웅성거리며 성적표 앞에 몰려 있다.\n쭉 올라가보니 전교 1등 — 강민재.\n같은 반 민재? "하나도 안 했는데"라고 했던 그 민재가?',
    location: 'hallway',
    background: 'hallway_{school}',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return s.year >= 2 && !!minjae?.met && minjae.intimacy >= 15 && [8, 17].includes(s.week);
    },
    choices: [
      {
        text: '"야, 1등이네? 대단하다" — 말을 건다',
        effects: { social: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '"어... 뭐, 운이 좋았어." 민재가 태연한 척했지만 귀가 살짝 빨개졌다. 운이 아닌 걸 나도 안다.',
      },
      {
        text: '그냥 지나친다',
        effects: {},
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '복도를 지나가는데 민재와 눈이 마주쳤다. 민재가 어색하게 웃고 지나갔다. 묘한 기분이다.',
      },
    ],
  },
  // v1.2 소프트 위기: 민재 질투 (부록 D.1)
  {
    id: 'minjae-jealousy',
    title: '굳어진 민재',
    description: '쉬는 시간, 반 공부 1등 민재가 평소와 다르다.\n내가 최근에 성적이 올랐다는 소문을 들은 눈치다.\n민재가 말을 걸었지만, 목소리는 평소보다 한 톤 낮다.\n"...너 요즘 진짜 다르더라."',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    speakers: ['minjae'],
    // M5 Phase 2: intimacy 60 → 30, academic 55 → 45로 완화. NPC decay 완화 후에도
    // 60은 도달 어려움. 소프트 크라이시스 연간 2건 상한(events.ts)이 과잉 발동 방지.
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 30
        && (s.year === 2 || s.year === 3)
        && s.stats.academic >= 45
        && !s.isVacation;
    },
    choices: [
      {
        text: '어색하게 먼저 자리를 뜬다',
        effects: { mental: -2, social: -1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: -3 }],
        message: '민재 눈을 피해 교실을 먼저 나섰다. 무언가 풀리지 않은 채로 남았다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 5,
          toneTag: 'regret',
          recallText: '그 가을, 민재의 눈을 피해 먼저 교실을 나섰다.',
          npcIds: ['minjae'],
        },
      },
      {
        text: '"미안, 너 덕분에 자극 받았어" — 솔직히 말한다',
        effects: { social: 3, mental: 3 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 6 }],
        message: '민재가 잠깐 말을 잃더니 "...알아" 하고 고개를 돌렸다. 그래도 어깨의 힘이 조금 풀린 것 같았다.',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 6,
          toneTag: 'warm',
          recallText: "사과했더니 민재가 '알아'라고만 했다. 그걸로 충분했다.",
          npcIds: ['minjae'],
        },
      },
      {
        text: '"솔직히 나도 지기 싫어" — 경쟁을 인정한다',
        effects: { social: 2, academic: 2, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 4 }],
        message: '"...그래?" 민재가 피식 웃었다. 처음으로 "지는 게 싫다"고 민재가 직접 말해줬다. 경쟁이지만, 같은 편 같기도 한.',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 6,
          toneTag: 'resolve',
          recallText: '지는 게 싫다고, 민재가 처음으로 말해줬다.',
          npcIds: ['minjae'],
        },
      },
    ],
  },
  {
    id: 'minjae-effort',
    title: '새벽의 비밀',
    description: '학원 가려고 가방을 가지러 교실에 왔다.\n불이 꺼진 줄 알았는데, 구석 자리에 민재가 앉아 있다.\n스탠드 하나 켜놓고 노트를 펼치고 있다.\n학원장 아들이 학원도 안 가고 여기서...? "하나도 안 했는데"라고 했던 애가?',
    location: 'classroom',
    background: 'classroom_{school}_sunset',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 25 && !s.isVacation && s.year >= 2
        && s.events.some(e => e.id === 'minjae-ranking');
    },
    choices: [
      {
        text: '"너... 공부 많이 하는구나" — 솔직하게 말한다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 6 }],
        message: '민재가 굳었다. 한참 만에 "...들켰네." 웃지 않는 민재. 처음으로 가면이 벗겨진 순간이다. "이거 아무한테도 말하지 마."',
        memorySlotDraft: {
          category: 'discovery',
          importance: 6,
          toneTag: 'warm',
          recallText: '스탠드 불 하나, "들켰네"라고 말하던 민재의 굳은 얼굴.',
          npcIds: ['minjae'],
        },
      },
      {
        text: '"뭐야, 너도 벼락치기?" — 가볍게 넘긴다',
        effects: { social: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '"그래, 나도 사람이지 뭐." 민재가 웃었다. 하지만 그 웃음이 평소와 좀 달랐다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 4,
          toneTag: 'regret',
          recallText: '민재의 웃음 뒤에 뭔가를 못 본 척했던 그 밤.',
          npcIds: ['minjae'],
        },
      },
    ],
  },
  {
    id: 'minjae-pressure',
    title: '엄마의 전화',
    description: '쉬는 시간에 복도를 지나가는데 민재가 전화를 받고 있다.\n"...네. 알겠어요."\n수화기 너머로 날카로운 목소리가 들린다.\n"그 아이한테 졌다며? 원장님 아들이 이래서야..."\n"...알겠어요." 민재가 고개를 숙인다.',
    location: 'hallway',
    background: 'hallway_{school}',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 40 && !s.isVacation && s.year >= 2 && [9, 18, 35, 39].includes(s.week);
    },
    choices: [
      {
        text: '못 들은 척 지나간다',
        effects: { mental: -1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '민재가 전화를 끊고 잠시 서 있다가 교실로 돌아갔다. 평소와 같은 표정으로. 아까 전화를 떠올리니 복잡하다.',
      },
      {
        text: '전화가 끝날 때까지 기다렸다가 다가간다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 6 }],
        message: '"...들었어?" "조금." 민재가 한참 아무 말 안 하다가 작게 말했다. "우리 엄마 학원 원장이야. 아빠는 교사고. 나한테 지는 게 없어."',
      },
      {
        text: '"야, 매점 가자" — 화제를 돌린다',
        effects: { social: 1, mental: 1 },
        moneyEffect: -1,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '민재가 잠깐 멈칫하다가 따라왔다. 아이스크림을 먹으면서 아무 말 안 했지만, 돌아갈 때 "...고마워" 했다.',
      },
    ],
  },
  {
    id: 'minjae-honest',
    title: '교실에 남은 민재',
    description: '방과후가 끝나고 다들 가는데 민재가 교실에 남아 있다.\n책상 위에 펜만 쥐고 아무것도 안 쓰고 있다.\n가까이 가니 눈이 좀 붉다.\n"...아, 너 아직 안 갔어?"',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 55 && !s.isVacation && s.year >= 4;
    },
    choices: [
      {
        text: '아무 말 없이 옆에 앉는다',
        effects: { mental: 3, social: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 6 }],
        message: '한참 침묵이 흘렀다. "나 이거 왜 하는 건지 모르겠어." 민재가 펜을 내려놓았다. "1등 해도 아무것도 안 달라져. 엄마는 더 하래, 아빠는 당연하대." 처음 듣는 민재의 진짜 목소리다.',
        memorySlotDraft: {
          category: 'reconciliation',
          importance: 7,
          toneTag: 'warm',
          recallText: '민재가 펜을 내려놓던 빈 교실의 침묵. 그 긴 시간.',
          npcIds: ['minjae'],
        },
      },
      {
        text: '"집에 안 가?" — 가볍게 묻는다',
        effects: { social: 1, mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 2 }],
        message: '"...좀 있다가." 민재가 웃었지만 평소와 달랐다. 뭔가 말하고 싶은 게 있는 것 같았는데, 타이밍이 지나갔다.',
      },
      {
        text: '그냥 지나간다',
        effects: {},
        npcEffects: [{ npcId: 'minjae', intimacyChange: -1 }],
        message: '복도를 걸으며 뒤를 돌아봤다. 교실 불이 꺼지지 않았다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 5,
          toneTag: 'regret',
          recallText: '복도를 걸으며 돌아본, 꺼지지 않은 교실 불.',
          npcIds: ['minjae'],
        },
      },
    ],
  },
  {
    id: 'minjae-dream',
    title: '의대가 전부야?',
    description: '점심시간에 민재가 옥상으로 부른다.\n바람을 맞으며 한참 동안 아무 말 없이 서 있다가,\n"야 솔직히... 나 의사 되고 싶은 건지 모르겠어."\n"그냥 가장 틀리지 않는 대답이라서 의대라고 한 거야."',
    location: 'rooftop',
    background: 'rooftop',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 65 && s.year >= 6 && !s.isVacation;
    },
    choices: [
      {
        text: '"그럼 뭘 하고 싶어?" — 물어본다',
        effects: { social: 3, mental: 4 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 6 }],
        message: '"...모르겠어. 그걸 모르는 게 제일 무서워." 민재가 처음으로 완전히 솔직했다. "근데 너한테는 말할 수 있어서 다행이다."',
        memorySlotDraft: { category: 'discovery', importance: 7, toneTag: 'melancholy', recallText: '모르는 게 제일 무섭다던 민재가, 처음으로 솔직했다.', npcIds: ['minjae'] },
      },
      {
        text: '"일단 가서 생각해도 되지 않아?" — 현실적으로 답한다',
        effects: { mental: 2, social: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '"...그것도 맞는 말이긴 해." 민재가 쓸쓸하게 웃었다. "그게 안 되니까 문제지."',
      },
      {
        text: '"네가 정하는 거야. 네 인생이잖아" — 단호하게 말한다',
        effects: { social: 2, mental: 5 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 5 }],
        message: '민재가 한참 동안 아무 말 안 했다. 그러다 "야... 그 말 진짜 좋다." 주먹을 내밀었다. 쿵. 라이벌이자, 유일하게 진짜를 보여줄 수 있는 사이.',
        memorySlotDraft: { category: 'growth', importance: 8, toneTag: 'resolve', recallText: '네 인생이라 하자, 민재가 말없이 주먹을 내밀었다. 쿵.', npcIds: ['minjae'] },
      },
    ],
  },
] satisfies readonly GameEvent[];
