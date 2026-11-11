import type { GameEvent, GameState } from '../types';
import { isDating, ROMANCE_OUTING2_IDS, ROMANCE_OUTING2_TEXT, ROMANCE_OUTING_IDS, romanceOutingChoice, type RomanceNpc } from '../romance';
import { absWeek } from '../weekMath';

function available(s: GameState, npc: RomanceNpc): boolean {
  return s.year >= 6 && s.year <= 7 && s.week < 48 && isDating(s, npc)
    && !s.relationship?.graduation
    && !s.events.some(e => e.id === ROMANCE_OUTING_IDS[npc]);
}

/** 두 번째 만남 사이 간격 — 첫 만남과 같은 달에 연달아 열리면 '추억'이 아니라 연속극이 된다. */
export const ROMANCE_OUTING2_GAP = 4;
function available2(s: GameState, npc: RomanceNpc): boolean {
  const first = s.events.find(e => e.id === ROMANCE_OUTING_IDS[npc]);
  return s.year >= 6 && s.year <= 7 && s.week < 48 && isDating(s, npc)
    && !s.relationship?.graduation
    && romanceOutingChoice(s, ROMANCE_OUTING_IDS[npc]) !== undefined
    && first?.year !== undefined && first.week !== undefined
    && absWeek(s.year, s.week) - absWeek(first.year, first.week) >= ROMANCE_OUTING2_GAP
    && !s.events.some(e => e.id === ROMANCE_OUTING2_IDS[npc]);
}
const head2 = (npc: RomanceNpc) => `${ROMANCE_OUTING2_TEXT[npc].head}\n${ROMANCE_OUTING2_TEXT[npc].tail}`;

// 배열 순서 = 한 판에서 겪는 순서. 연인과 놀았던 주에는 아직 열 수 있는 것 중 앞의 것 하나만 연다(selection.ts).
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
  {
    id: ROMANCE_OUTING2_IDS.subin, title: '이번에는 내가 들어줄게', speakers: ['subin'],
    location: 'park', background: 'park', condition: s => available2(s, 'subin'),
    description: head2('subin'),
    choices: [
      { text: '"사실 요즘…" 마음에 걸리던 걸 꺼낸다', effects: {}, npcEffects: [{ npcId: 'subin', intimacyChange: 0 }],
        message: '수빈이는 끼어들지 않고 끝까지 들었다. "말해 줘서 고마워. 해결은 못 해도, 같이 들고 있을 수는 있어." 비행기가 두 대 더 지나갔다.',
        memorySlotDraft: { category: 'growth', importance: 6, toneTag: 'warm', recallText: '비행기가 지나가는 언덕에서, 수빈이에게 처음으로 내 얘기를 꺼냈다.', npcIds: ['subin'] } },
      { text: '"오늘은 그냥 이렇게 같이 있어 줘."', effects: {}, npcEffects: [{ npcId: 'subin', intimacyChange: 0 }],
        message: '"응. 그것도 얘기야." 수빈이가 어깨를 살짝 기댔다. 둘은 말없이 하늘만 봤다.',
        memorySlotDraft: { category: 'growth', importance: 6, toneTag: 'warm', recallText: '말없이 수빈이와 비행기를 세던 강변 언덕의 오후.', npcIds: ['subin'] } },
    ],
  },
  {
    id: ROMANCE_OUTING2_IDS.jihun, title: '승부 없는 한 판', speakers: ['jihun'],
    location: 'park', background: 'park', condition: s => available2(s, 'jihun'),
    description: head2('jihun'),
    choices: [
      { text: '"그럼 몇 번 이어지는지만 같이 세자."', effects: {}, npcEffects: [{ npcId: 'jihun', intimacyChange: 0 }],
        message: '열하나에서 셔틀콕이 떨어졌다. "아깝다!" 둘이 동시에 외쳤다. 다음 랠리에선 지훈이가 일부러 높게 띄워 줬다.',
        memorySlotDraft: { category: 'growth', importance: 6, toneTag: 'warm', recallText: '지훈이와 같이 숫자를 세며 랠리를 이어 가던 공터.', npcIds: ['jihun'] } },
      { text: '"세지도 말자. 떨어지면 같이 웃기."', effects: {}, npcEffects: [{ npcId: 'jihun', intimacyChange: 0 }],
        message: '셔틀콕은 자주 떨어졌고, 그때마다 둘 다 웃었다. 지훈이가 라켓을 내리며 말했다. "이렇게 치는 게 제일 재밌다, 진짜."',
        memorySlotDraft: { category: 'growth', importance: 6, toneTag: 'warm', recallText: '이긴 사람 없이, 웃느라 자꾸 셔틀콕을 놓치던 한 판.', npcIds: ['jihun'] } },
    ],
  },
];
