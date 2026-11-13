// @vitest-environment jsdom
// 엔딩의 연인 갤러리 — 고3 순간(두 번째 만남·졸업 약속)은 학년말 회고가 없어 여기서만 보인다.
// 잠그는 것: ① 엔진이 판 전체의 연애 순간을 겪은 순서로 내고 ② 화면이 슬롯의 year(엔딩 state.year=8 아님)와
// 판본으로 그림을 해석하며 ③ 회상 갤러리에 이미 나온 장면은 빼고 ④ 관계가 없으면 그리지 않는다.
// 회상·후회·근황의 선정은 memorySlots만 읽으므로 이 갤러리가 생겨도 그대로다(⑤).
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { EndingScreen } from '../EndingScreen';
import { calculateEnding } from '../../../engine/ending';
import { getBackground } from '../../../engine/backgrounds';
import { GAME_EVENTS } from '../../../engine/events';
import { presentRomanceEvent, ROMANCE_OUTING2_IDS, ROMANCE_OUTING_IDS } from '../../../engine/romance';
import { yearToPhaseTag } from '../../../engine/memorySystem';
import { makeState } from '../../../test/fixtures';
import type { GameEvent, GameState, MemorySlot } from '../../../engine/types';
import type { RomanceRelationship } from '../../../engine/romance';

vi.mock('../../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));

const DATING: RomanceRelationship = { npcId: 'jihun', status: 'dating', year: 6, week: 26, graduation: 'together' };
const ctx = (year: number, week: number, relationship?: RomanceRelationship) =>
  ({ gender: 'female' as const, year, week, events: [], relationship });
/** 화면에 나갔던 판(present 결과)을 기록 레코드로 — recordResolvedEvent와 같은 모양. */
const record = (e: GameEvent, year: number, week: number, resolvedChoice: number): GameEvent =>
  ({ ...e, year, week, resolvedChoice, resolvedFemale: !!e.femaleChoices });
const event = (id: string) => GAME_EVENTS.find(e => e.id === id)!;

/** 지훈 여주판: 고2 26주 고백 수락 → 30주 첫 만남 → 고3 10주 두 번째 만남 → 46주 졸업 '계속 만나자'. */
function endingState(patch: Partial<GameState> = {}): GameState {
  const opening = presentRomanceEvent(event('jihun-hs-unsaid'), ctx(6, 26));
  const closing = presentRomanceEvent(event('jihun-hs-graduation'), ctx(7, 46, { ...DATING, graduation: undefined }));
  const togetherIdx = (closing.femaleChoices ?? closing.choices).findIndex(c => c.relationshipSelect?.decision === 'together');
  const s = makeState({
    gender: 'female', year: 8, week: 1, memorySlots: [], relationship: DATING,
    events: [
      record(opening, 6, 26, (opening.femaleChoices ?? opening.choices).findIndex(c => c.relationshipSelect?.decision === 'date')),
      record(event(ROMANCE_OUTING_IDS.jihun), 6, 30, 0),
      record(event(ROMANCE_OUTING2_IDS.jihun), 7, 10, 1),
      record(closing, 7, 46, togetherIdx),
    ],
  });
  s.npcs = s.npcs.map(n => n.id === 'jihun' ? { ...n, met: true, intimacy: 95 } : n);
  return { ...s, ...patch };
}

function renderEnding(state: GameState) {
  return render(
    <EndingScreen ending={calculateEnding(state)} track={state.track} stats={state.stats} parents={state.parents}
      burnoutCount={0} money={0} runDelta={null} gender={state.gender} onRestartSameHome={null} onExitToTitle={() => {}}
      bgProps={{ bg: getBackground(state.week, false, 'normal', state.year), bgImgError: true, onImgError: vi.fn() }} />,
  );
}
const FILES = ['high/jihun-hs-unsaid_c3_f.png', 'high/jihun-romance-outing_f.png', 'high/jihun-romance-outing2_f.png',
  'high/jihun-hs-graduation_c3_f.png'];

describe('엔딩 연인 갤러리', () => {
  it('엔진 — 판 전체의 연애 순간을 겪은 순서로, 연인 이름과 함께', () => {
    const g = calculateEnding(endingState()).romanceGallery!;
    expect(g.npcName).toBe('지훈');
    expect(g.moments.map(m => [m.sourceEventId, m.year])).toEqual([
      ['jihun-hs-unsaid', 6], [ROMANCE_OUTING_IDS.jihun, 6], [ROMANCE_OUTING2_IDS.jihun, 7], ['jihun-hs-graduation', 7]]);
  });

  it('화면 — 고2·고3 순간 네 장을 여주판 그림으로(엔딩 year=8이 아니라 슬롯의 year로) 보인다', () => {
    renderEnding(endingState());
    const block = screen.getByTestId('ending-romance-gallery');
    expect(within(block).getByText('지훈과 함께한 순간')).toBeTruthy();
    const srcs = [...block.querySelectorAll('img')].map(i => i.getAttribute('src') ?? '');
    for (const f of FILES) expect(srcs.some(s => s.includes(f)), f).toBe(true);
    expect(within(block).getAllByText('고3').length).toBeGreaterThan(0);
    expect(within(block).getAllByText('고2').length).toBeGreaterThan(0);
  });

  it('회상 갤러리에 이미 나온 장면은 빼서 같은 그림이 두 번 나오지 않는다', () => {
    const slot: MemorySlot = { id: 'growth_6_30_0', category: 'growth', week: 30, year: 6, sourceEventId: ROMANCE_OUTING_IDS.jihun,
      choiceIndex: 0, recallText: '배드민턴을 치고 나서, 지훈이와 기록을 재지 않고 나란히 걸었다.', npcIds: ['jihun'],
      importance: 6, phaseTag: yearToPhaseTag(6), toneTag: 'warm' };
    const state = endingState({ memorySlots: [slot] });
    const ending = calculateEnding(state);
    expect(ending.memorialHighlights.some(h => h.slot?.sourceEventId === ROMANCE_OUTING_IDS.jihun), '전제: 회상이 첫 만남을 골랐다').toBe(true);
    expect(ending.romanceGallery!.moments.map(m => m.sourceEventId)).not.toContain(ROMANCE_OUTING_IDS.jihun);
    renderEnding(state);
    const srcs = [...document.querySelectorAll('img')].map(i => i.getAttribute('src') ?? '');
    expect(srcs.filter(s => s.includes(FILES[1]))).toHaveLength(1);
  });

  it('재고백으로 사귄 판 — 재고백 수락이 고백 수락 그림으로 뜬다(그 매핑은 고2~고3 학년에만 있어 슬롯 year가 필수)', () => {
    const retry: GameEvent = {
      id: 'jihun-romance-revisit', title: '그때 하지 못한 말', description: '', year: 6, week: 34, resolvedChoice: 0,
      choices: [{ text: '좋아해', effects: {}, npcEffects: [], message: '',
        relationshipSelect: { npcId: 'jihun', decision: 'date' },
        memorySlotDraft: { category: 'growth', importance: 7, toneTag: 'warm', recallText: '미처 하지 못한 말을 전하고 지훈이와 연인이 되었다.', npcIds: ['jihun'] } }],
    };
    const base = endingState();
    const state = { ...base, relationship: { ...DATING, week: 34 }, events: [retry, ...base.events.slice(1)] };
    expect(calculateEnding(state).romanceGallery!.moments[0].sourceEventId).toBe('jihun-romance-revisit');
    renderEnding(state);
    const srcs = [...screen.getByTestId('ending-romance-gallery').querySelectorAll('img')].map(i => i.getAttribute('src') ?? '');
    expect(srcs.some(s => s.includes(FILES[0])), '재고백 = 고백 수락 그림').toBe(true);
  });

  it('헤어진 판은 겪은 순간(고백·만남)만, 졸업 약속은 없다', () => {
    const ended = endingState({ relationship: { ...DATING, status: 'ended', graduation: 'apart' } });
    expect(calculateEnding(ended).romanceGallery!.moments.map(m => m.sourceEventId))
      .toEqual(['jihun-hs-unsaid', ROMANCE_OUTING_IDS.jihun, ROMANCE_OUTING2_IDS.jihun]);
  });

  it('관계가 없으면 갤러리를 그리지 않는다 — 나머지 엔딩 층은 그대로', () => {
    const none = endingState({ relationship: undefined });
    const a = calculateEnding(none), b = calculateEnding(endingState());
    expect('romanceGallery' in a, '연인 없는 판엔 키도 없다(엔딩 지문 불변)').toBe(false);
    renderEnding(none);
    expect(screen.queryByTestId('ending-romance-gallery')).toBeNull();
    // 회상·후회는 memorySlots만 읽는다 — 갤러리 유무가 그 선정을 바꾸지 않는다.
    expect(a.memorialHighlights).toEqual(b.memorialHighlights);
    expect(a.regretHighlights).toEqual(b.regretHighlights);
  });
});
