// 첫 연애 루트: 기존 관계 사건을 변주한다. 자동 고백·추가 사건·별도 호감도 없음.
import type { EventChoice, GameEvent, GameState, Gender } from './types';

export type RomanceNpc = 'subin' | 'jihun';
export type RomanceDecision = 'friends' | 'date' | 'together' | 'apart';
export interface RomanceRelationship {
  npcId: RomanceNpc;
  status: 'friends' | 'dating' | 'ended';
  year: number;
  week: number;
  graduation?: 'together' | 'apart';
}
export type RomanceContext = Pick<GameState, 'gender' | 'year' | 'week'> & Partial<Pick<GameState, 'relationship'>>;

export const ROMANCE_ROUTES = {
  subin: { gender: 'male', opening: 'subin-hs-studyboard', closing: 'subin-farewell', tier: 68 },
  jihun: { gender: 'female', opening: 'jihun-hs-unsaid', closing: 'jihun-hs-graduation', tier: 70 },
} as const satisfies Record<RomanceNpc, { gender: Gender; opening: string; closing: string; tier: number }>;

// 없는 기록은 그대로 둔다. 구세이브의 친밀도·선택지 번호에서 연애를 추정하지 않는다.
export function sanitizeRelationship(value: unknown, gender: Gender): RomanceRelationship | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const r = value as RomanceRelationship;
  if ((r.npcId !== 'subin' && r.npcId !== 'jihun') || ROMANCE_ROUTES[r.npcId].gender !== gender
      || !['friends', 'dating', 'ended'].includes(r.status)
      || r.year !== 6 || !Number.isInteger(r.week) || r.week < 1 || r.week > 48) return undefined;
  if (r.graduation !== undefined && r.graduation !== 'together' && r.graduation !== 'apart') return undefined;
  if ((r.status === 'ended') !== (r.graduation === 'apart')
      || (r.status === 'friends' && r.graduation !== undefined)) return undefined;
  return { npcId: r.npcId, status: r.status, year: r.year, week: r.week,
    ...(r.graduation ? { graduation: r.graduation } : {}) };
}

export function isDating(state: RomanceContext, npcId: string): boolean {
  const r = sanitizeRelationship(state.relationship, state.gender);
  return !!r && r.npcId === npcId && r.status === 'dating' && state.year >= r.year;
}

// 선택 엔진과 관계 신호가 같은 문턱을 읽는다. 남주 지훈의 기존 우정 곡선은 유지.
export function romanceEventEligibility(event: GameEvent, state: GameState): GameEvent {
  if (event.id === ROMANCE_ROUTES.jihun.opening && state.gender === 'female') {
    return { ...event, reach: { npc: 'jihun', tier: 70, year: 6 },
      condition: s => s.year === 6 && !s.isVacation && !!s.npcs.find(n => n.id === 'jihun' && n.met && n.intimacy >= 70) };
  }
  if (event.id === ROMANCE_ROUTES.jihun.closing && isDating(state, 'jihun')) {
    return { ...event, reach: { npc: 'jihun', tier: 0, year: 7 },
      condition: s => s.year === 7 && s.week >= 40 && !s.isVacation && isDating(s, 'jihun') };
  }
  return event;
}

function choicesFor(event: GameEvent, npcId: RomanceNpc, entries: [string, string, RomanceDecision][]): EventChoice[] {
  // 우정/연애에 동일한 결과. 연애를 능력치 최적화 선택으로 만들지 않는다.
  const base = event.choices[0];
  return entries.map(([text, message, decision]) => ({
    ...base, text, message, relationshipSelect: { npcId, decision },
    memorySlotDraft: { category: 'growth', importance: 7, toneTag: 'warm',
      recallText: decision === 'date' ? `${npcId === 'subin' ? '수빈이' : '지훈이'}와 서로 좋아한다는 마음을 확인한 날.`
        : decision === 'friends' ? `${npcId === 'subin' ? '수빈이' : '지훈이'}와 솔직히 마음을 나누고 친구로 남은 날.`
        : decision === 'together' ? '각자의 길을 가면서도 연인으로 만나기로 한 약속.'
        : '함께한 시간을 소중히 여기며 첫 연애를 마무리한 날.', npcIds: [npcId] },
  }));
}

export function presentRomanceEvent(event: GameEvent, state: RomanceContext): GameEvent {
  const npcId: RomanceNpc = state.gender === 'male' ? 'subin' : 'jihun';
  const route = ROMANCE_ROUTES[npcId];
  let description: string;
  let entries: [string, string, RomanceDecision][];
  if (event.id === route.opening && state.year === 6 && !state.relationship) {
    description = npcId === 'subin'
      ? '스터디카페에서 수빈이와 영어 단어 퀴즈를 내다가, 둘 다 웃음을 터뜨렸다.\n수빈이가 단어장을 덮고 물었다. "나 사실, 공부 핑계로 너랑 둘이 있고 싶었어."\n"친구로도 좋지만… 나는 너랑 사귀어 보고 싶어. 너는 어때?"'
      : '야자 빠진 저녁, 둘만 남은 교실에 노을이 들었다.\n지훈이가 가방끈을 만지작거리다 입을 열었다. "너랑 있으면 편한데, 요즘은 좀 떨리기도 해."\n"오래된 친구라서 하는 말 아니야. 나 너 좋아해. 우리 사귈래?"';
    entries = npcId === 'subin' ? [
      ['"나는 친구로 지내고 싶어. 너랑 있는 건 좋아."', '수빈이가 고개를 끄덕였다. "알겠어. 솔직하게 말해줘서 고마워." 잠깐 조용해졌다가, 수빈이가 단어장을 다시 펼쳤다. "그럼 친구야, 다음 문제 내봐."', 'friends'],
      ['"나도 좋아해. 우리 사귀자."', '"진짜?" 수빈이가 웃다가 단어장으로 얼굴을 가렸다. "그럼 다음엔 공부 핑계 안 댄다?" 나도 웃으며 고개를 끄덕였다. 오늘부터 우리는 연인이다.', 'date'],
    ] : [
      ['"나는 친구로 지내고 싶어. 넌 소중한 친구야."', '지훈이가 숨을 길게 내쉬었다. "응. 말해줘서 고마워." 가방을 챙기며 조금 웃었다. "오늘은 좀 어색해도, 내일은 같이 가자." 친구로 함께 가기로 했다.', 'friends'],
      ['"나도 좋아해. 우리 사귀자."', '지훈이가 대답을 듣고도 한 번 더 물었다. "진짜?" 그러고는 웃음을 못 감췄다. 늘 걷던 하굣길인데, 오늘은 손을 잡기 전에 서로 눈을 봤다. 오늘부터 우리는 연인이다.', 'date'],
    ];
  } else if (event.id === route.closing && state.year === 7 && isDating(state, npcId)) {
    description = npcId === 'subin'
      ? '졸업을 앞두고 수빈이와 학원 앞에 섰다.\n"앞으로는 시간 맞추기가 좀 어렵겠지? 그래도 네 얘기 듣고 싶어. 나도 내 길 가면서."\n수빈이가 내 손을 잡았다. "우리, 졸업하고도 계속 만날까?"'
      : '졸업을 앞두고 지훈이와 함께 찍은 사진들을 골랐다.\n"학교가 달라지면 매일 같이 걷진 못하겠네." 지훈이가 휴대폰을 내려놓았다.\n"그래도 나는 너랑 계속 만나고 싶어. 너는 어때?"';
    entries = [
      ['"응. 각자 할 일 하면서, 계속 만나자."', npcId === 'subin'
        ? '"답장 늦어도 혼자 결론 내리지 않기." 수빈이가 새끼손가락을 내밀었다. 서로의 꿈을 멈추지 않고, 연인으로 계속 만나기로 했다.'
        : '"바쁘면 바쁘다고 말하기. 혼자 삐치지 않기." 지훈이와 웃으며 약속했다. 다른 학교에 가도, 연인으로 계속 만나기로 했다.', 'together'],
      ['"좋았던 마음은 고마워. 연인으로서는 여기까지 하고 싶어."', npcId === 'subin'
        ? '수빈이가 잠시 손을 내려다보다 고개를 끄덕였다. "서운하긴 해. 그래도 솔직하게 말해줘서 고마워." 함께한 시간을 지우지 않고, 서로의 길을 응원하기로 했다.'
        : '지훈이가 한동안 사진을 보다가 고개를 끄덕였다. "응. 같이 있던 시간은 좋았어." 당장 아무렇지 않을 순 없어도, 서로의 선택을 존중하기로 했다.', 'apart'],
    ];
  } else if (event.id.startsWith('jihun-') && npcId === 'jihun' && state.relationship?.npcId === 'jihun' && state.relationship.status !== 'dating') {
    // 우정을 택한 뒤 기존 여주 전용 대사가 다시 고백을 암시하지 않게 기본 우정 장면을 사용.
    return { ...event, femaleDescription: undefined, femaleChoices: undefined };
  } else return event;
  return { ...event, description, choices: choicesFor(event, npcId, entries),
    femaleDescription: undefined, femaleChoices: undefined, presentedFemaleChoices: undefined };
}

export function applyRelationshipChoice(state: GameState, event: GameEvent, choice: EventChoice, week: number): void {
  const selection = choice.relationshipSelect;
  if (!selection) return;
  const route = ROMANCE_ROUTES[selection.npcId];
  if (!route || route.gender !== state.gender) return;
  const { npcId, decision } = selection;
  if (event.id === route.opening && state.year === 6 && !state.relationship
      && (decision === 'date' || decision === 'friends')
      && state.npcs.some(n => n.id === npcId && n.met && n.intimacy >= route.tier)) {
    state.relationship = { npcId, status: decision === 'date' ? 'dating' : 'friends', year: state.year, week };
  } else if (event.id === route.closing && state.year === 7 && isDating(state, npcId)
      && (decision === 'together' || decision === 'apart')) {
    state.relationship = { ...state.relationship!, status: decision === 'apart' ? 'ended' : 'dating', graduation: decision };
  }
}

export function romanceLines(state: RomanceContext, npcId: string): string[] | null {
  const r = sanitizeRelationship(state.relationship, state.gender);
  if (r?.npcId === npcId && r.status !== 'dating') return npcId === 'subin' ? [
    '"야, 오늘은 내가 퀴즈 낼 차례야. 준비됐어?"',
    '"우리 다음에는 공부 말고 재밌는 얘기도 좀 하자."',
    '"오늘 웃긴 일 있었는데, 들어볼래?"',
  ] : [
    '"야, 오늘 어땠냐? 나 할 얘기 있는데 네 얘기부터 들어볼게."',
    '"가끔은 별말 안 하고 같이 있어도 좋더라."',
    '"너도 할 일 잘하고 와. 다음에 만나면 내가 간식 살게."',
  ];
  if (!isDating(state, npcId)) return null;
  return npcId === 'subin' ? [
    '"오늘은 내가 먼저 연락했지? 그냥 네 생각 나서."',
    '"다음엔 내가 퀴즈 낼게. 우리 처음 사귄 날 내가 가린 건 무슨 책?" 수빈이가 웃었다.',
    '"나 오늘 웃긴 일 있었는데, 너한테 제일 먼저 말하고 싶었어."',
    '"각자 바쁜 날도 있는 거지. 나중에 만나면 얘기 많이 해줘."',
  ] : [
    '"사귀면 안 떨릴 줄 알았는데, 네가 웃으면 아직 좀 그래."',
    '"오늘도 네 얘기부터 들어볼까? 내 얘기는 조금 이따가."',
    '"우리 사진 한 장 더 찍자. 이번에는 내가 눈 안 감을게."',
    '"오늘은 각자 할 일 하고, 나중에 얘기하자. 나도 응원할게."',
  ];
}

export function romanceClosure(state: GameState, npcId: string): { text: string; excludeEventIds: Set<string> } | null {
  const r = sanitizeRelationship(state.relationship, state.gender);
  if (!r || r.npcId !== npcId) return null;
  const name = npcId === 'subin' ? '수빈이' : '지훈이';
  const text = r.status === 'friends' ? `${name}와는 친구로 지내기로 했다. 서로의 마음을 솔직하게 말했던 날도, 우리 우정의 한 장면으로 남았다.`
    : r.status === 'ended' ? `${name}와의 첫 연애는 졸업을 앞두고 끝났다. 함께 웃었던 시간과 서로의 선택을 존중한 마지막 대화가 남았다.`
    : r.graduation === 'together' ? `${name}와는 졸업 후에도 연인으로 만나고 있다. 각자의 길을 가면서, 서로의 하루를 나누기로 한 약속을 이어 간다.`
    : `${name}와는 서로 마음을 확인하고 연인이 되었다. 사귀기로 한 날의 웃음은, 평범했던 하루를 오래 기억하게 했다.`;
  return { text, excludeEventIds: new Set([ROMANCE_ROUTES[r.npcId].opening, ROMANCE_ROUTES[r.npcId].closing]) };
}
