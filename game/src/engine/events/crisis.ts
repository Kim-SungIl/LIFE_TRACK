import { GameEvent, GameState } from '../types';

export const CRISIS_EVENTS: GameEvent[] = [
  // ===== HARD 크라이시스 이벤트 (연간 1회 상한, hardCrisisYears 가드) =====
  // v1.2 §4.3 — middle-burnout 외 3종. 각 학년대 변곡점에 배치.
  {
    id: 'high-panic',
    title: '새벽 세 시, 숨이 막혔다',
    description: '문제집 펴놓고 졸다가 깼다.\n시계를 보니 새벽 세 시.\n갑자기 심장이 빠르게 뛰고, 숨을 쉬어도 들이마신 느낌이 안 든다.\n"...뭐지, 이거."',
    condition: (s: GameState) => s.year >= 5 && s.year <= 7 && s.stats.mental <= 55 && s.stats.academic >= 50,
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
    condition: (s: GameState) => s.year >= 3 && s.year <= 6 && (s.idleWeeks >= 4 || (s.stats.mental <= 45 && s.stats.academic <= 55)),
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
    condition: (s: GameState) => (s.year === 5 || s.year === 6) && s.stats.mental <= 55 && !s.events.some(e => e.id === 'identity-crisis'),
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
    condition: (s: GameState) => {
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
    condition: (s: GameState) => {
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
    condition: (s: GameState) => {
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
    condition: (s: GameState) => {
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

];
