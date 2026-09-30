// @vitest-environment jsdom
// 완주 재커밋 — T61. T57이 "실패를 고지"까지 했고, 여기서 **되살린다**.
//
// 남아 있던 구멍(실측 재현): 기록 키만 포화시켜 완주 → 용량 정상화 → 이어하기에서
//   events 2 · talks 1 은 복구되는데  runs 0 · endings [] 는 그대로였고, 경고까지 내려갔다.
// 비대칭의 원인은 근거의 유무다. 이벤트·잡담·CG·친밀도는 전부 집합 의미론이라 `mergeState`가
// 세이브에서 자가치유하지만, 완주는 **phase가 'ending'으로 넘어가는 순간**에만 존재하는
// 사건이라 되살릴 재료가 state에 없었다.
//
// 그래서 판에 신원(state.runId)을 주고 기록층에 원장 한 칸(lastCommittedRunId)을 둔다.
// 둘이 다르면 "아직 안 닿았다"이고, 이어하기가 그때만 재커밋한다.
//
// ⚠️ 이 파일이 지켜야 하는 건 복구**와** 중복 방지 둘 다다. 한쪽만 잠그면 반대쪽이 조용히
// 깨진다 — 복구만 보면 매 이어하기마다 완주가 부풀고, 중복만 보면 복구를 지워도 통과한다.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginRun, clearArchive, commitRun, loadArchive, needsRecommit, newRunId,
} from '../archive';
import { useGameStore } from '../store';
import { CURRENT_SAVE_VERSION } from '../stateMigration';
import { failWritesTo } from '../../test/failingStorage';
import { createInitialState } from '../gameEngine';
import { calculateEnding } from '../ending';
import type { GameEvent, GameState, ParentStrength } from '../types';

const ARCHIVE_KEY = 'lifetrack_archive';
const SAVE_KEY = 'lifetrack_save';
const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const ev = (id: string): GameEvent => ({ id, title: id, description: '', choices: [] }) as GameEvent;

/** 엔딩에 도달한 판 — 이벤트·잡담이 실려 있어야 "무엇이 복구되고 무엇이 안 되는가"가 보인다. */
function endedRun(runId: string | undefined): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 4242 });
  s.year = 7; s.week = 48; s.phase = 'ending';
  s.events = [ev('first-week'), ev('good-grade')];
  s.talkEventsFired = ['talk-yuna-1'];
  s.runId = runId;
  return s;
}

function putSave(s: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version: CURRENT_SAVE_VERSION, state: JSON.parse(JSON.stringify(s)), savedAt: new Date().toISOString(),
  }));
}

/**
 * 기록 쓰기가 죽은 채로 완주한다 — 디스크에는 아무것도 안 남는다.
 * 제목은 **제품과 같은 근거**로 만든다: 복구 경로가 calculateEnding으로 다시 계산하므로,
 * 손으로 쓴 제목을 기대하면 "제목이 다르다"가 아니라 그냥 픽스처가 거짓말인 것이다.
 */
function completeWithDeadArchive(s: GameState): void {
  const restore = failWritesTo(ARCHIVE_KEY);
  try { commitRun(s, calculateEnding(s).title); } finally { restore(); }
}

beforeEach(() => {
  localStorage.clear();
  clearArchive();
  beginRun();            // 성공한 쓰기 하나로 앞 테스트의 실패 플래그를 되돌린다
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('하네스 자기검사 — 정말로 유실된 상태에서 출발하는가', () => {
  // 이게 없으면 아래 복구 단언들이 "애초에 안 잃은 것"을 재는 것일 수 있다.
  it('기록 쓰기가 죽은 채 완주하면 디스크는 그대로다', () => {
    const s = endedRun(newRunId());
    completeWithDeadArchive(s);
    const a = loadArchive();
    expect(a.runs, '유실을 못 만들었다 — 아래 복구 단언이 공허하다').toBe(0);
    expect(a.endings).toEqual([]);
    expect(a.lastCommittedRunId).toBeUndefined();
  });
});

describe('이어하기가 완주를 되살린다', () => {
  it('용량 정상화 뒤 이어하기 — runs·endings가 돌아온다', () => {
    const s = endedRun(newRunId());
    completeWithDeadArchive(s);
    putSave(s);

    expect(useGameStore.getState().loadSavedGame(), '세이브를 못 열었다').toBe(true);

    const a = loadArchive();
    // 착지값을 못 박는다 — "0보다 크다"로 두면 두 번 세도 통과한다(#424 계열).
    expect(a.runs, '완주가 안 돌아왔다').toBe(1);
    // 되살린 제목이 **원래 커밋이 썼을 제목과 같은가** — 여기가 복구의 정확성이다.
    expect(a.endings, '엔딩 목록이 안 돌아왔다').toEqual([calculateEnding(s).title]);
    expect(a.lastCommittedRunId, '원장에 신원이 안 남았다').toBe(s.runId);
    // 집합 축은 원래도 자가치유되던 것 — 재커밋이 그걸 망가뜨리지 않았는지 같이 본다.
    expect(a.events.sort()).toEqual(['first-week', 'good-grade']);
    expect(a.talks).toEqual(['talk-yuna-1']);
  });

  it('두 번 이어하기해도 완주는 한 번만 센다', () => {
    const s = endedRun(newRunId());
    completeWithDeadArchive(s);
    putSave(s);

    useGameStore.getState().loadSavedGame();
    useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
    useGameStore.getState().loadSavedGame();

    expect(loadArchive().runs, '이어하기마다 완주가 부푼다').toBe(1);
  });

  it('정상 완주한 판은 이어하기에서 다시 세지 않는다', () => {
    const s = endedRun(newRunId());
    commitRun(s, calculateEnding(s).title);   // 쓰기 성공 — 원장에 신원이 남는다
    expect(loadArchive().runs).toBe(1);
    putSave(s);

    useGameStore.getState().loadSavedGame();

    expect(loadArchive().runs, '이미 닿은 판을 또 셌다').toBe(1);
    expect(loadArchive().endings, '엔딩이 중복 적재됐다').toEqual([calculateEnding(s).title]);
  });

  // 원장은 **runs와 같은 쓰기에 실려야** 한다. 리더가 이 필드를 안 읽으면 매 로드마다
  // undefined가 되어 위 "두 번" 테스트가 무너진다 — 그 경로를 직접 본다.
  it('원장이 loadArchive 왕복을 넘어 살아남는다', () => {
    const s = endedRun(newRunId());
    commitRun(s, calculateEnding(s).title);
    const raw = localStorage.getItem(ARCHIVE_KEY);
    expect(raw, '기록이 디스크에 없다').toBeTruthy();
    expect(JSON.parse(raw!).lastCommittedRunId, '직렬화에서 빠졌다').toBe(s.runId);
    expect(loadArchive().lastCommittedRunId, '리더가 화이트리스트에서 빠뜨렸다').toBe(s.runId);
  });
});

describe('구세이브 — 모르면 안 센다', () => {
  it('신원 없는 엔딩 세이브는 재커밋하지 않는다', () => {
    const s = endedRun(undefined);
    putSave(s);
    useGameStore.getState().loadSavedGame();
    // 이미 세어졌는지 알 길이 없다. 재커밋 실패는 기록 한 줄이 없는 것이고,
    // 중복 계상은 **없던 완주를 만들어낸다** — 후자가 더 나쁘다.
    expect(loadArchive().runs, '판정 불가인 구세이브를 셌다').toBe(0);
  });

  it('신원 없는 진행 중 세이브는 신원을 백필받는다', () => {
    const s = createInitialState('female', PARENTS, { rngSeed: 7 });
    s.year = 3; s.phase = 'weekday'; s.runId = undefined;
    putSave(s);
    useGameStore.getState().loadSavedGame();
    const loaded = useGameStore.getState().state;
    expect(loaded?.runId, '이후 판이 보호를 못 받는다').toBeTruthy();
    expect(loadArchive().runs, '진행 중인 판을 완주로 셌다').toBe(0);
  });
});

describe('판정 자체 — needsRecommit', () => {
  it('세 조건이 각각 필요하다', () => {
    const id = newRunId();
    const ended = endedRun(id);
    expect(needsRecommit(ended), '유실된 완주를 못 알아봤다').toBe(true);

    commitRun(ended, calculateEnding(ended).title);
    expect(needsRecommit(ended), '이미 닿은 판을 대상으로 봤다').toBe(false);

    expect(needsRecommit({ ...ended, runId: undefined }), '구세이브를 대상으로 봤다').toBe(false);
    expect(needsRecommit({ ...endedRun(newRunId()), phase: 'weekday' }), '진행 중인 판을 대상으로 봤다').toBe(false);
  });

  it('신원은 판마다 다르다', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newRunId()));
    // 충돌하면 그 판의 완주가 **통째로 스킵**된다 — 조용한 유실이라 더 나쁘다.
    expect(ids.size, '신원이 겹쳤다').toBe(200);
  });
});
