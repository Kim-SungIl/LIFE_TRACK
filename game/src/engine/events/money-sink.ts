import { GameEvent, GameState } from '../types';

export const MONEY_SINK_EVENTS: GameEvent[] = [
  // ===== M4: 돈 싱크 이벤트 =====
  // 수학여행 — 중1 가을 (Y2 W28) — 경주
  {
    id: 'school-trip-middle',
    title: '수학여행 신청서',
    description: '담임이 종이 한 장을 나눠준다.\n"다음 달 수학여행이다. 경주 2박 3일, 참가비 10만원. 내일까지 제출."\n책상에 신청서가 놓인다.\n옆자리에서 "같이 가야지?" 하는 목소리가 들린다.',
    week: 28,
    condition: (s: GameState) => s.year === 2 && !s.isVacation,
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
    condition: (s: GameState) => s.year === 5 && !s.isVacation,
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
    condition: (s: GameState) => s.year === 1,
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
    condition: (s: GameState) => s.year === 7,
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
    condition: (s: GameState) => s.year === 5 && !s.isVacation,
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
];
