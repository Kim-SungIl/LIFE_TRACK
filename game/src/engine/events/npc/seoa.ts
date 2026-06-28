import { GameEvent } from '../../types';

// 윤서아(seoa) — 중2 데뷔, 내성적 글쟁이. 한쪽 이어폰=한 칸 열림 / 양쪽=닫힘 코드.
// intro에서 '두 번 울리는 문(경첩)' 모티프를 심고, t90에서 회수(수미상관).
export const SEOA_EVENTS = [
  {
    id: 'seoa-meet',
    title: '두 번 울리는 문',
    description: '점심시간, 비어 있어야 할 음악실 문이 한 번에 안 열린다. 경첩이 두 번 울리고서야 틈이 벌어진다. 안에 낯선 전학생 — 긴 머리에 이어폰을 양쪽 다 꽂고, 무릎 위 노트에 뭔가 적고 있다. 인기척에 노트를 가슴팍으로 끌어안아 덮는다.\n서아: "…여기 비는 줄 알았는데. 안 본 거 맞지. 그냥 손이 심심해서 그어둔 거야."',
    location: 'music_room',
    background: 'music_room_middle',
    speakers: ['seoa'],
    condition: (s) => {
      const seoa = s.npcs.find(n => n.id === 'seoa');
      return s.year === 2 && !seoa?.met && !s.isVacation;
    },
    choices: [
      { text: '"문이 두 번 울려야 열리더라. 나도 방금 알았어" 문 얘기만 한다', effects: { mental: 2, social: 1 },
        npcEffects: [{ npcId: 'seoa', intimacyChange: 10 }],
        message: '서아가 끌어안은 팔의 힘을 한 칸 푼다. "…너도 두 번에 열었구나. 다들 한 번에 안 열린다고 그냥 가던데." 한쪽 이어폰을 만지작거린다, 아직 안 뺀다.' },
      { text: '"무슨 글 쓰는데?" 노트로 시선이 간다', effects: { mental: 1 },
        npcEffects: [{ npcId: 'seoa', intimacyChange: 6 }],
        message: '끌어안은 팔이 도로 굳는다. "…글 아니야. 그냥 그은 거." 양쪽 이어폰을 고쳐 낀다.' },
      { text: '"여기 내 자리야. 비켜줄래"', effects: {},
        npcEffects: [{ npcId: 'seoa', intimacyChange: 3 }],
        message: '서아가 노트와 펜을 챙겨 일어선다. 문이 또 두 번에 닫힌다.' },
    ],
  },
] satisfies readonly GameEvent[];
