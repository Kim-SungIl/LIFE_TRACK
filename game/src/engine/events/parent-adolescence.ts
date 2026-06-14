import { GameEvent } from '../types';

// ===== Phase 4D — 사춘기 골짜기 (중2~3, Y3~4) =====
// 관계의 "골짜기 → 회복" 곡선(§10). 전 부모 공통(강점 무관) — 사춘기는 부모 유형을 가리지 않는다.
//  · 한시 배율 하락: Y3~4엔 familyTime/shareWorry 반응 ×0.75 (parentIntimacy.ts) — 이 시기 하락은 정상.
//  · 방문 쾅 이벤트(Y3 W26): 마이너스 선택지로 골짜기를 깊게 팔 수도, 솔직함으로 완만하게 둘 수도.
//  · 화해 비트(Y5 W26): 골짜기를 겪고(clash 발동) 회복했을 때(친밀도≥60)만 해금 — "그땐 미안했어".
// 화자: 일상 가정 voice인 '엄마'(강점 SSOT가 아닌 보편 비트 — 두 부모 중 늘 존재하는 엄마의 평상 목소리).
// 고정 주차 풀 이벤트(W26은 전 학년 미점유). 스탯 퍼주기 금지: 작은 멘탈 + 친밀도 굴곡 + 회상만.

export const ADOLESCENCE_EVENTS: GameEvent[] = [
  {
    id: 'adolescence-clash',
    title: '쾅',
    description: '별것도 아닌 일로 엄마랑 부딪혔다.\n"너 요즘 왜 그래?" 그 한마디에 뭔가 욱했다.\n…나도 내가 왜 이러는지 모르겠다.',
    week: 26,
    condition: (s) => s.year === 3,
    location: 'home',
    background: 'home_evening',
    choices: [
      {
        text: '방문을 쾅 닫는다',
        effects: { mental: 2 },  // 분출의 즉각적 후련함(가시) ↔ 친밀도 −1.5(숨은 대가). 트레이드오프 명확화
        parentEffect: { baseDelta: -1.5, tag: 'hideProblem' },
        message: '방문이 쾅 닫혔다. 집이 조용해졌다.',
        memorySlotDraft: {
          category: 'betrayal', importance: 5, toneTag: 'regret',
          recallText: '별것 아닌 일로 방문을 쾅 닫던 날.',
        },
      },
      {
        text: '울컥했지만 말없이 방에 들어간다',
        effects: { mental: -1 },
        parentEffect: { baseDelta: -0.5, tag: 'hideProblem' },
        message: '아무 말 없이 방문을 닫았다. 삼킨 말이 가슴에 남았다.',
      },
      {
        text: '"…죄송해요. 저도 잘 모르겠어요." 솔직히 말한다',
        effects: { mental: 1 },
        parentEffect: { baseDelta: 1.0, tag: 'shareWorry' },
        message: '엄마는 잠깐 말이 없다가, "그래, 그럴 때지" 했다.',
        memorySlotDraft: {
          category: 'reconciliation', importance: 5, toneTag: 'warm',
          recallText: '사춘기 한가운데, 솔직히 마음을 꺼낸 날.',
        },
      },
    ],
  },
  {
    id: 'adolescence-reconcile',
    title: '그땐, 미안했어',
    description: '문득 지나가듯 그 얘기가 나왔다.\n"너 중학교 때 한창 예민했잖아. …그때 우리도 좀 서툴렀지."\n한참 멀게 느껴지던 거리가, 어느새 메워져 있었다.',
    week: 26,
    // 골짜기를 겪고(clash 발동) 회복(친밀도≥60)한 가정에만 해금. 끝내 멀어졌으면 화해 없이 distant로 — 그것도 서사.
    condition: (s) => s.year === 5
      && s.events.some(e => e.id === 'adolescence-clash')
      && (s.parentIntimacy ?? 50) >= 60,
    location: 'home',
    background: 'home_evening',
    choices: [
      {
        text: '"저도 그때 죄송했어요." 마음을 전한다',
        effects: { mental: 3 },
        parentEffect: { baseDelta: 1.2, tag: 'shareWorry' },
        message: '둘 다 웃었다. 지난 그 시절이 그제야 다 메워진 느낌이었다.',
        memorySlotDraft: {
          category: 'reconciliation', importance: 5, toneTag: 'warm',
          recallText: '예민하던 그 시절을 건너왔다고 서로 인정한 날.',
        },
      },
      {
        text: '"이제 와서 뭘…" 쑥스러워 웃어넘긴다',
        effects: { mental: 2 },
        parentEffect: { baseDelta: 0.6, tag: 'familyTime' },
        message: '쑥스러워 말은 못 했지만, 서로 알았을 거다.',
        memorySlotDraft: {
          category: 'reconciliation', importance: 5, toneTag: 'warm',
          recallText: '굳이 말 안 해도 통했던, 그 저녁.',
        },
      },
    ],
  },
];
