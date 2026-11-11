import type { GameEvent, GameState } from '../types';
import { isDating, ROMANCE_OUTING_IDS, type RomanceNpc } from '../romance';

function available(s: GameState, npc: RomanceNpc): boolean {
  return s.year >= 6 && s.year <= 7 && s.week < 48 && isDating(s, npc)
    && !s.relationship?.graduation
    && !s.events.some(e => e.id === ROMANCE_OUTING_IDS[npc]);
}

export const ROMANCE_OUTING_EVENTS: GameEvent[] = [
  {
    id: ROMANCE_OUTING_IDS.subin, title: '단어장을 덮은 뒤', speakers: ['subin'],
    location: 'cafe', background: 'cafe', condition: s => available(s, 'subin'),
    description: '함께 놀기로 한 날, 카페에서 수빈이의 영어 연습을 잠깐 도왔다. 수빈이가 단어장을 덮고 컵을 두 손으로 감싼다.\n"오늘은 내 얘기만 했네. 너는 요즘 어떤 앞날을 생각해? 아직 잘 모르겠다는 답도 괜찮아."\n발음을 따라 읽던 때와 달리, 이번에는 답을 재촉하지 않고 기다린다.',
    choices: [
      { text: '"아직 찾는 중이지만, 너랑 이런 얘기는 계속하고 싶어."', effects: {}, npcEffects: [{ npcId: 'subin', intimacyChange: 0 }],
        message: '"응. 정답 정해 놓고 묻는 거 아니니까." 수빈이가 웃었다. 단어장은 그대로 둔 채 서로 하고 싶은 일과 아직 모르는 것들을 이야기했다.',
        memorySlotDraft: { category: 'growth', importance: 6, toneTag: 'warm', recallText: '단어장을 덮고, 수빈이와 아직 정해지지 않은 앞날을 이야기했다.', npcIds: ['subin'] } },
      { text: '"일단 다음에도 네 맞은편 자리 예약부터 할게."', effects: {}, npcEffects: [{ npcId: 'subin', intimacyChange: 0 }],
        message: '"그건 너무 가까운 미래 아니야?" 수빈이가 웃다가 고개를 끄덕였다. "그래도 좋아. 다음엔 네 얘기부터 듣기다." 컵이 식는 줄도 모르고 한참을 더 앉아 있었다.',
        memorySlotDraft: { category: 'growth', importance: 6, toneTag: 'warm', recallText: '수빈이 맞은편 자리를 예약한다며 웃었던 카페의 오후.', npcIds: ['subin'] } },
    ],
  },
  {
    id: ROMANCE_OUTING_IDS.jihun, title: '기록을 재지 않는 산책', speakers: ['jihun'],
    location: 'park', background: 'park', condition: s => available(s, 'jihun'),
    description: '함께 놀러 나온 공원에서 지훈이와 한참 배드민턴을 쳤다. 라켓을 가방에 넣고 나서자 늘 성큼성큼 걷던 지훈이가 보폭을 줄인다.\n"오늘은 기록 안 잰다. 걷는 것도 그냥 걷자."\n라켓 가방을 어깨에 고쳐 메던 지훈이가 덧붙인다. "앞으로 바빠져도, 가끔 이렇게 걷고 싶다."',
    choices: [
      { text: '"나도. 멀리 안 가도 같이 걸으면 좋더라."', effects: {}, npcEffects: [{ npcId: 'jihun', intimacyChange: 0 }],
        message: '지훈이가 신발 끝을 한번 내려다보다 웃었다. "그럼 다음에도 이 속도로." 뒤에서 들려오던 셔틀콕 소리가 멀어질 때까지 나란히 걸었다.',
        memorySlotDraft: { category: 'growth', importance: 6, toneTag: 'warm', recallText: '배드민턴을 치고 나서, 지훈이와 기록을 재지 않고 나란히 걸었다.', npcIds: ['jihun'] } },
      { text: '"그럼 오늘 천천히 걷기 대회는 공동 우승이네."', effects: {}, npcEffects: [{ npcId: 'jihun', intimacyChange: 0 }],
        message: '"그것도 대회로 만드는 거야?" 지훈이가 소리 내 웃었다. "좋아. 공동 우승은 계속 같이 가야 인정이다." 둘 다 일부러 한 걸음씩 느리게 걸었다.',
        memorySlotDraft: { category: 'growth', importance: 6, toneTag: 'warm', recallText: '지훈이와 천천히 걷기 대회 공동 우승을 약속하며 웃었다.', npcIds: ['jihun'] } },
    ],
  },
];
