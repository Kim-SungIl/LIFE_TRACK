import { GameEvent } from '../../types';

// 강예린(yerin) — 고1(Y5) 데뷔, 입시 전략가·효율의 언어·모럴그레이. 사람을 장부/단가/손익으로 번역.
// intro '단가표'가 곧 첫 도달 장면을 겸한다(노트 N/A 모티프 발아 → t58·t68에서 회계 콜백).
export const YERIN_EVENTS = [
  {
    id: 'yerin-meet',
    title: '단가표',
    description: '쉬는 시간, 예린이 의자를 끌고 옆자리로 와 노트를 편다. 반 아이들 이름 옆마다 단가표가 빼곡하다 — \'필기 정확, A\', \'발표 강함, B+\', \'내신 직접경쟁, 감점\'. 들킨 걸 알면서 가리지 않고, 오히려 노트를 내 쪽으로 살짝 돌려 보여준다. 표 맨 아래 내 이름 줄, 단가란에만 \'N/A\'가 적혀 있고, 그 위로 두 줄이 그어져 있다.\n예린: "사람 미리 단가 매겨두는 거야. 욕할 거면 해. 근데 너도 내 노트 덕 볼걸."',
    location: 'classroom',
    background: 'classroom_high',
    speakers: ['yerin'],
    condition: (s) => {
      const yerin = s.npcs.find(n => n.id === 'yerin');
      return s.year === 5 && !yerin?.met && !s.isVacation;
    },
    choices: [
      { text: '"내 단가, 뭐든 적어도 돼. 궁금하니까" 표 안으로 들어간다', effects: { social: 1 },
        npcEffects: [{ npcId: 'yerin', intimacyChange: 8 }],
        message: '예린이 그어둔 N/A를 잠깐 본다. "…적었다 또 긋고 할 건데, 그래도 거래 틀래?" 처음으로 누가 제 장부 안으로 들어온다.' },
      { text: '"단가 안 매겨진 게 차라리 낫다. 매겨지면 언제 손절당할지 모르잖아"', effects: { mental: 1 },
        npcEffects: [{ npcId: 'yerin', intimacyChange: 7 }],
        message: '예린이 펜을 딸깍 눌렀다 뗀다. "…A 받은 애들도 다 한 번씩 손절됐어. 잘 아네." N/A를 그대로 둔다.' },
      { text: '"그게 친구를 보는 눈이야?" 정면으로 묻는다', effects: {},
        npcEffects: [{ npcId: 'yerin', intimacyChange: 4 }],
        message: '예린이 0.5초 멈칫, 노트를 도로 당겨 덮고 다른 애 단가란을 가리킨다. "…오늘 필기 얘는 A야. 빌릴 거면 정해." 말 대신 화제를 거래로 옮긴다.' },
    ],
  },
] satisfies readonly GameEvent[];
