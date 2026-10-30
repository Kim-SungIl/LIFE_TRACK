// @vitest-environment jsdom
// 최소 계측(engine/telemetry.ts) — 이 기기에만 쌓는 익명 기록이 설계안 §12의 판정 기준을 실제로 잴 수 있게 쌓이는가.
//   ① 모듈 — 적기·읽기·상한·손상·저장소 차단, 요약(칸 안 고친 달 비율·판당 월중 멈춤·대화·등급)
//   ② 배선 — 새 판·재생 멈춤·이야기로 이어진 대화·엔딩·월 계획 시작이 각자 한 번씩 적힌다(잡담·보류 선택지 재열람은 안 적힌다)
//   ③ 내보내기 — 시스템 메뉴 버튼이 파일을 만들고, 그 본문에 요약과 원본이 있다
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { SystemMenu } from '../SystemMenu';
import { MonthPlanScreen } from '../screens/main/MonthPlanScreen';
import { TELEMETRY_FILE_NAME } from '../telemetryExport';
import {
  MAX_TELEMETRY_EVENTS, TELEMETRY_KEY, exportTelemetry, readTelemetry, recordTelemetry, summarizeTelemetry,
  type TelemetryEvent,
} from '../../engine/telemetry';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { getAvailableNpcEvents, getAvailableHomeEvents, getEligibleParentClimax } from '../../engine/talkSystem';
import { getWeekInfo } from '../../engine/weekMath';
import { makeEvent } from '../../test/fixtures';
import type { GameState, MonthPlan } from '../../engine/types';

const api = () => useGameStore.getState();
const now = () => api().state!;
const events = () => readTelemetry().events;
const kinds = (t: TelemetryEvent['t']) => events().filter(e => e.t === t);

beforeEach(() => {
  cleanup();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_month_tutorial_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('① 모듈', () => {
  it('적은 순서대로 읽힌다', () => {
    recordTelemetry({ t: 'run', monthly: true });
    recordTelemetry({ t: 'stop', y: 1, w: 3, reason: 'player' });
    expect(events()).toEqual([{ t: 'run', monthly: true }, { t: 'stop', y: 1, w: 3, reason: 'player' }]);
  });

  it('상한을 넘으면 오래된 것부터 버린다', () => {
    const many: TelemetryEvent[] = Array.from({ length: MAX_TELEMETRY_EVENTS }, (_, i) => ({ t: 'stop', y: 1, w: i, reason: 'player' }));
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify({ v: 1, events: many }));
    recordTelemetry({ t: 'run', monthly: false });
    const ev = events();
    expect(ev).toHaveLength(MAX_TELEMETRY_EVENTS);
    expect(ev[0]).toEqual({ t: 'stop', y: 1, w: 1, reason: 'player' });
    expect(ev[ev.length - 1]).toEqual({ t: 'run', monthly: false });
  });

  it.each([
    ['JSON이 아니다', '{not json'],
    ['버전이 다르다', JSON.stringify({ v: 99, events: [] })],
    ['events가 배열이 아니다', JSON.stringify({ v: 1, events: {} })],
    ['모르는 종류가 섞였다', JSON.stringify({ v: 1, events: [{ t: 'wat' }] })],
  ])('손상된 기록은 고치지 않고 새로 시작한다(%s)', (_label, raw) => {
    localStorage.setItem(TELEMETRY_KEY, raw);
    expect(events()).toEqual([]);
    recordTelemetry({ t: 'run', monthly: true });
    expect(events()).toEqual([{ t: 'run', monthly: true }]);
  });

  it('저장소가 쓰기를 막아도 던지지 않는다', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    try {
      expect(() => recordTelemetry({ t: 'run', monthly: true })).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });

  it('요약 — 칸 안 고친 달 비율(다시 짜기 제외), 판당 월중 멈춤(계절 경계 제외), 대화, 등급', () => {
    const log = { v: 1 as const, events: [
      { t: 'run', monthly: true },
      { t: 'month', y: 1, m: 1, week: 1, replan: false, edits: 2, fills: 0, invitesAccepted: 1, invitesDeclined: 0 },
      { t: 'month', y: 1, m: 2, week: 5, replan: false, edits: 0, fills: 1, invitesAccepted: 0, invitesDeclined: 0 },
      { t: 'month', y: 1, m: 2, week: 6, replan: true, edits: 0, fills: 0, invitesAccepted: 0, invitesDeclined: 0 },
      { t: 'stop', y: 1, w: 3, reason: 'talk' },
      { t: 'stop', y: 1, w: 19, reason: 'season' },
      { t: 'stop', y: 1, w: 7, reason: 'burnout' },
      { t: 'talk', y: 1, w: 3, to: 'npc' },
      { t: 'talk', y: 1, w: 4, to: 'home' },
      { t: 'ending', achievement: 'A', happiness: 'B', burnouts: 1 },
      { t: 'run', monthly: true },
    ] satisfies TelemetryEvent[] };
    const s = summarizeTelemetry(log);
    expect(s.runs).toBe(2);
    expect(s.months, '다시 짜기는 달 수에 안 넣는다').toBe(2);
    expect(s.untouchedMonths).toBe(1);
    expect(s.untouchedRatio).toBe(0.5);
    expect(s.stops).toEqual({ talk: 1, season: 1, burnout: 1 });
    expect(s.midMonthStopsPerRun, '계절 경계는 설계상 반드시 서는 자리라 뺀다').toBe(1);
    expect(s.talks).toEqual({ npc: 1, home: 1 });
    expect(s.endings).toEqual({ 'A/B': 1 });
    const empty = summarizeTelemetry({ v: 1, events: [] });
    expect([empty.untouchedRatio, empty.midMonthStopsPerRun]).toEqual([null, null]);
  });
});

describe('② 배선', () => {
  it('새 판을 시작하면 run 하나 — 월 단위 판인지도 적는다', () => {
    // 기본값과 무관하게 — 플래그 키로 두 판을 다 본다.
    localStorage.setItem('lifetrack_monthly_planning', '1');
    api().startGame('male', ['emotional', 'info']);
    expect(kinds('run')).toEqual([{ t: 'run', monthly: true }]);
    localStorage.setItem('lifetrack_monthly_planning', '0');
    api().startGame('male', ['emotional', 'info']);
    expect(kinds('run').map(e => (e as { monthly: boolean }).monthly)).toEqual([true, false]);
  });

  it('재생을 멈추면 멈춘 자리와 이유가 적힌다', () => {
    const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 5 });
    Object.assign(s, { year: 2, week: 5, phase: 'weekday', currentEvent: null, isVacation: false, routineSlot2: 'self-study', routineSlot3: null, money: 50 });
    for (const n of s.npcs) n.intimacy = 10; // 초대 없는 달
    const plan: MonthPlan = { year: 2, month: 2, weeks: [5, 6, 7, 8].map(week => ({ week, activities: ['rest', 'rest'], npcChoices: {} })), invites: [] };
    useGameStore.setState({ state: s });
    expect(api().setMonthPlan(plan)).toBeNull();
    api().startMonthPlayback();
    // 재생 카드(result)에서 ⏸ → 경계에서 멈춘다.
    for (let i = 0; i < 10 && now().phase === 'event'; i++) api().resolveEvent(0);
    expect(now().phase).toBe('result');
    api().pausePlayback('player');
    api().continuePlayback();
    expect(kinds('stop')).toEqual([{ t: 'stop', y: 2, w: now().week, reason: 'player' }]);
  });

  /** 친밀도 60 친구들 + 이번 주 말걸기 기회. */
  const talkable = (): GameState => {
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
    Object.assign(s, { year: 2, week: 9, phase: 'weekday', currentEvent: null, isVacation: getWeekInfo(9).isVacation, npcEventPendingThisWeek: true, parentEventPendingThisWeek: false });
    for (const n of s.npcs.filter(x => ['jihun', 'subin', 'minjae', 'yuna'].includes(x.id))) { n.met = true; n.intimacy = 60; }
    return s;
  };

  it('친구 말걸기가 이야기로 이어지면 하나, 잡담은 안 적는다', () => {
    const s = talkable();
    const target = s.npcs.find(n => getAvailableNpcEvents(s, n.id).length > 0)!;
    useGameStore.setState({ state: s });
    expect(api().talkToNpc(target.id).kind).toBe('event');
    expect(kinds('talk')).toEqual([{ t: 'talk', y: 2, w: 9, to: 'npc' }]);
    // 기회를 썼으니 이제 잡담 — 몇 번을 눌러도 안 늘어난다.
    for (let i = 0; i < 5; i++) expect(api().talkToNpc(target.id).kind).toBe('smalltalk');
    expect(kinds('talk')).toHaveLength(1);
  });

  it('가정 선택지 이벤트는 고른 순간에만 적힌다 — 띄우고 닫았다 다시 열어도 안 늘어난다', () => {
    const s = talkable();
    s.npcEventPendingThisWeek = false;
    s.parentEventPendingThisWeek = true;
    expect(getEligibleParentClimax(s), '전제: 절정 순간 없음').toBeNull();
    const ev = getAvailableHomeEvents(s).find(e => e.choices?.length);
    expect(ev, '전제: 선택지 있는 가정 이벤트').toBeTruthy();
    useGameStore.setState({ state: s });
    const r1 = api().talkToHome();
    expect(r1.kind).toBe('event');
    api().talkToHome();
    expect(kinds('talk'), '선택 전(보류)은 안 센다').toHaveLength(0);
    api().resolveParentTalkChoice((r1 as { event: { id: string } }).event.id, 0);
    expect(kinds('talk')).toEqual([{ t: 'talk', y: 2, w: 9, to: 'home' }]);
  });

  it('엔딩에 닿으면 등급이 한 번 적힌다', () => {
    const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 4242 });
    Object.assign(s, { year: 7, week: 49, phase: 'event', currentEvent: { ...makeEvent({ id: 'test-w48-pending' }), week: 48 } });
    useGameStore.setState({ state: s, runDelta: null, npcActivityMap: {} });
    for (let i = 0; i < 20 && now().phase === 'event'; i++) api().resolveEvent(0);
    expect(now().phase).toBe('ending');
    const ends = kinds('ending');
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ t: 'ending', burnouts: now().burnoutCount ?? 0 });
    expect(typeof (ends[0] as { achievement: unknown }).achievement).toBe('string');
  });

  it('월 계획을 시작하면 그 달이 적힌다 — 손으로 고친 칸·채우기 버튼 수, 초대 답', () => {
    const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 42 });
    Object.assign(s, { phase: 'weekday', currentEvent: null, routineSlot2: 'self-study', routineSlot3: null });
    for (const n of s.npcs) n.intimacy = 10; // 초대 없는 달 — 답을 안 해도 시작이 열린다
    const onStart = vi.fn(() => null);
    render(<MonthPlanScreen state={s} onSetRoutine={() => {}} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' }));
    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(kinds('month')).toEqual([{ t: 'month', y: 1, m: 1, week: 1, replan: false, edits: 0, fills: 1, invitesAccepted: 0, invitesDeclined: 0 }]);
  });

  it('시작이 거부되면(엔진 검증) 적지 않는다', () => {
    const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 42 });
    Object.assign(s, { phase: 'weekday', currentEvent: null, routineSlot2: 'self-study', routineSlot3: null });
    for (const n of s.npcs) n.intimacy = 10;
    render(<MonthPlanScreen state={s} onSetRoutine={() => {}} onStart={() => '거부'} />);
    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));
    expect(kinds('month')).toHaveLength(0);
  });
});

describe('③ 내보내기', () => {
  it('본문에 요약과 원본이 있다 — 이름·세이브는 없다', () => {
    api().startGame('male', ['emotional', 'info']);
    const out = JSON.parse(exportTelemetry());
    expect(out.app).toBe('lifetrack');
    expect(out.summary.runs).toBe(1);
    expect(out.events).toEqual(events());
    expect(JSON.stringify(out)).not.toContain('runId');
  });

  it('시스템 메뉴 버튼이 파일을 만든다', () => {
    const created: Blob[] = [];
    const orig = { c: URL.createObjectURL, r: URL.revokeObjectURL };
    URL.createObjectURL = vi.fn((b: Blob) => { created.push(b); return 'blob:x'; }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clicks: string[] = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.download); });
    try {
      render(<SystemMenu onExit={() => {}} onClose={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: /플레이 기록 내보내기/ }));
      expect(created).toHaveLength(1);
      expect(created[0].type).toBe('application/json');
      expect(clicks).toEqual([TELEMETRY_FILE_NAME]);
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = orig.c;
      URL.revokeObjectURL = orig.r;
    }
  });
});
