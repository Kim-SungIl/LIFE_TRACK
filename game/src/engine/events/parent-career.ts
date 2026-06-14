import { GameEvent } from '../types';

// ===== Phase 4C — 부모 진로 갈등 (고1~2, Y5~Y6) =====
// "원하는 진로 vs 부모 기대" — info/strict 부모와의 줄다리기. ignoreAdvice/autonomyChoice 태그의 무대(§10).
// 화자 SSOT: strict=아빠 / info=엄마. info+strict 가정은 strict arc 우선(info는 !strict 게이트).
// 고정 주차 풀 이벤트라 확실히 발동(트랙선택처럼). Y5 W15=첫 모의고사 직후 진로 불안 / Y6 W6=트랙선택 직후.
// ⚠️ W6은 yuna-meet-elementary(speakers 보유)와 주차를 공유한다 — 현재는 그쪽 condition이 year===1이라 고2(Y6)에선
//    매칭 안 돼 충돌 없음. 혹시 yuna 첫만남의 year 게이트를 완화하면 getEventForWeek의 speakers 우선(selection.ts)에
//    Y6 진로갈등이 밀릴 수 있으니 주차를 옮길 것. (W15는 단독 점유)
// 선택 3종: 순응(keepPromise/careerTalk +) · 내 길(breakPromise/ignoreAdvice −) · 설득(autonomyChoice +, 절제).
// 스탯 퍼주기 금지: 진로 '결과'는 불변(ending은 수능·스탯만 봄). 여기선 작은 멘탈/학업 + 친밀도 굴곡 + 회상만.

export const CAREER_CONFLICT_EVENTS: GameEvent[] = [
  // ===== strict arc — 아빠 =====
  {
    id: 'career-conflict-strict-y5',
    title: '아빠가 정해둔 길',
    description: '모의고사 성적표가 식탁에 놓였다.\n아빠가 한참 들여다보더니, 고른 말처럼 천천히 입을 열었다.\n"이 정도면 안정적인 데로 노려볼 만해. …괜히 고생할까 봐 그래."\n…내가 하고 싶은 건 그게 아닌데, 말이 목에 걸렸다.',
    week: 15,
    condition: (s) => s.year === 5 && s.parents.includes('strict'),
    location: 'home',
    background: 'dinner_table',
    choices: [
      {
        text: '"…알겠어요." 아빠 말을 따르기로 한다',
        effects: { academic: 1, mental: -2 },
        parentEffect: { baseDelta: 1.2, tag: 'keepPromise' },
        message: '아빠 뜻을 따르기로 했다. 내 바람은 일단 접어뒀다.',
        memorySlotDraft: {
          category: 'growth', importance: 5, toneTag: 'burden',
          recallText: '내 바람을 접고 아빠 뜻을 따르기로 한 날.',
        },
      },
      {
        text: '"저는 하고 싶은 게 따로 있어요." 정면으로 말한다',
        effects: { mental: 2, academic: -1 },
        parentEffect: { baseDelta: -1.2, tag: 'breakPromise' },
        message: '하고 싶은 걸 처음 입 밖에 냈다. 식탁이 한동안 조용했다.',
        memorySlotDraft: {
          category: 'discovery', importance: 5, toneTag: 'resolve',
          recallText: '아빠 앞에서 내 길을 처음 입 밖에 낸 날.',
        },
      },
      {
        text: '"제 생각을 한번 들어봐 주세요." 차분히 설득한다',
        effects: { mental: 1 },
        parentEffect: { baseDelta: 0.8, tag: 'autonomyChoice' },
        message: '내 생각을 차근차근 말했다. 못마땅한 표정이었지만, 끝까지 듣긴 했다.',
        memorySlotDraft: {
          category: 'reconciliation', importance: 5, toneTag: 'warm',
          recallText: '아빠를 마주 앉혀 내 생각을 차분히 말한 날.',
        },
      },
    ],
  },
  {
    id: 'career-conflict-strict-y6',
    title: '문이과 너머의 기대',
    description: '문이과를 정하고 나니, 아빠의 기대는 더 또렷해졌다.\n"그 길로 갈 거면 학과까지 정해놨겠지? 한눈팔지 말고 좁혀."\n작년부터 이어진 줄다리기가, 다시 식탁에 올라왔다.',
    week: 6,
    condition: (s) => s.year === 6 && s.parents.includes('strict') && s.track !== null,
    location: 'home',
    background: 'dinner_table',
    choices: [
      {
        text: '"아빠 말대로 할게요." 기대에 맞춘다',
        effects: { academic: 1, mental: -2 },
        parentEffect: { baseDelta: 1.4, tag: 'keepPromise' },
        message: '끝내 아빠가 그려둔 쪽으로 방향을 맞췄다.',
        memorySlotDraft: {
          category: 'growth', importance: 5, toneTag: 'burden',
          recallText: '끝내 아빠가 정한 쪽으로 방향을 맞춘 날.',
        },
      },
      {
        text: '"학과는 제가 정할게요." 못박는다',
        effects: { mental: 2, academic: -1 },
        parentEffect: { baseDelta: -1.4, tag: 'breakPromise' },
        message: '이번엔 물러서지 않았다. 아빠도 더는 말을 잇지 않았다.',
        memorySlotDraft: {
          category: 'discovery', importance: 5, toneTag: 'resolve',
          recallText: '학과만큼은 내가 정하겠다고 못박은 날.',
        },
      },
      {
        text: '"제 계획을 보여드릴게요." 정리해서 설득한다',
        effects: { mental: 1 },
        parentEffect: { baseDelta: 1.0, tag: 'autonomyChoice' },
        message: '내 계획을 차근차근 펼쳐 보였다. 아빠는 짧게 "한번 해봐라" 했다.',
        memorySlotDraft: {
          category: 'reconciliation', importance: 5, toneTag: 'warm',
          recallText: '내 계획을 정리해 아빠를 마주한 날.',
        },
      },
    ],
  },

  // ===== info arc — 엄마 (info && !strict) =====
  {
    id: 'career-conflict-info-y5',
    title: '엄마가 알아본 길',
    description: '엄마가 진학 자료를 한 아름 안고 왔다.\n"엄마가 다 알아봤는데, 이 분야가 전망이 좋대. 여기로 방향 잡자."\n자료는 꼼꼼했다. 그런데 그건… 내가 가고 싶던 길이 아니었다.',
    week: 15,
    condition: (s) => s.year === 5 && s.parents.includes('info') && !s.parents.includes('strict'),
    location: 'home',
    background: 'dinner_table',
    choices: [
      {
        text: '"엄마가 알아본 대로 해볼게요." 따른다',
        effects: { academic: 1, mental: -1 },
        parentEffect: { baseDelta: 1.2, tag: 'careerTalk' },
        message: '엄마가 짚어준 길로 마음을 돌렸다. 그게 더 편한 길이긴 했다.',
        memorySlotDraft: {
          category: 'growth', importance: 5, toneTag: 'burden',
          recallText: '엄마가 짚어준 길로 마음을 돌린 날.',
        },
      },
      {
        text: '"그건 엄마 생각이고, 제가 알아볼게요." 선을 긋는다',
        effects: { mental: 2, academic: -1 },
        parentEffect: { baseDelta: -1.2, tag: 'ignoreAdvice' },
        message: '엄마 자료를 밀어뒀다. 엄마는 서운한 기색을 감추지 못했다.',
        memorySlotDraft: {
          category: 'discovery', importance: 5, toneTag: 'resolve',
          recallText: '엄마 자료를 밀어두고 내가 직접 찾기로 한 날.',
        },
      },
      {
        text: '"제가 원하는 걸 정리해서 보여드릴게요." 설득한다',
        effects: { mental: 1 },
        parentEffect: { baseDelta: 0.8, tag: 'autonomyChoice' },
        message: '내가 직접 모은 자료를 펼쳐 보였다. 엄마는 한참 보더니 고개를 끄덕였다.',
        memorySlotDraft: {
          category: 'reconciliation', importance: 5, toneTag: 'warm',
          recallText: '내가 정리한 자료로 엄마를 설득한 날.',
        },
      },
    ],
  },
  {
    id: 'career-conflict-info-y6',
    title: '자료 너머의 진심',
    description: '문이과를 정하자 엄마의 자료는 더 두꺼워졌다.\n"이 트랙이면 이 학과들이 유리해. 엄마가 표로 정리해놨어."\n엄마의 정성은 알겠는데, 자꾸 내 마음이 비집고 나왔다.',
    week: 6,
    condition: (s) => s.year === 6 && s.parents.includes('info') && !s.parents.includes('strict') && s.track !== null,
    location: 'home',
    background: 'dinner_table',
    choices: [
      {
        text: '"엄마 정리한 대로 갈게요." 따른다',
        effects: { academic: 1, mental: -1 },
        parentEffect: { baseDelta: 1.4, tag: 'careerTalk' },
        message: '엄마가 정리한 표 위에 내 진로를 얹었다.',
        memorySlotDraft: {
          category: 'growth', importance: 5, toneTag: 'burden',
          recallText: '엄마가 정리한 표 위에 내 길을 얹은 날.',
        },
      },
      {
        text: '"제가 직접 정한 데가 있어요." 내 길을 고른다',
        effects: { mental: 2, academic: -1 },
        parentEffect: { baseDelta: -1.4, tag: 'ignoreAdvice' },
        message: '내가 고른 곳을 말했다. 엄마는 표를 가만히 접었다.',
        memorySlotDraft: {
          category: 'discovery', importance: 5, toneTag: 'resolve',
          recallText: '엄마 표를 접게 하고 내가 고른 길을 말한 날.',
        },
      },
      {
        text: '"같이 한번 맞춰봐요." 내 안을 보태 조율한다',
        effects: { mental: 1 },
        parentEffect: { baseDelta: 1.0, tag: 'autonomyChoice' },
        message: '엄마 표 옆에 내가 찾은 걸 나란히 놨다. 둘이 한참을 들여다봤다.',
        memorySlotDraft: {
          category: 'reconciliation', importance: 5, toneTag: 'warm',
          recallText: '엄마 자료 옆에 내 걸 나란히 놓고 맞춰본 날.',
        },
      },
    ],
  },
];
