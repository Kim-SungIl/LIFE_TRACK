// verify-reach-pacing.ts — 중학 도달형 페이싱(burst 방지) 검증
// getReachForWeek를 Y2~Y4 전 주차에 호출해(= reach 발동 상한) 측정:
//  ① NPC별 연속 발동 간격 >= 쿨다운(16주, pre-met) — burst 없음
//  ② 주당 reach <= 1
//  ③ 이벤트 영구 1회성(중복 발동 없음)
//  ④ 커버리지(학년 게이트 내 발동 수) — 정보용. year===N 컷 유실은 의도된 설계.
// 실제 게임은 reach가 conditional 풀에서 50% 등으로 더 느리게 뜨므로, 이 sim은 최악(상한) 케이스다.
//
// **코퍼스가 0이면 공허하게 초록이 되던 자리** (2026-09-23 실측): GAME_EVENTS를 통째로 비운
// 사본으로 verify 스크립트 34종을 전수 실행했을 때 15종이 rc=1을 냈는데, 이 스크립트는 rc=0이었다.
// 이유는 단순하다 — 이 게이트는 `problems` **건수만** 센다. 발동이 0건이면 문제도 0건이라
// `✅ 전 시나리오 PASS — burst 없음`이 찍힌다. 게다가 헤더의 "중학 도달형(42개)"는 아무도
// 단언하지 않는 **리터럴**이었다. 42개가 0개가 돼도 헤더는 여전히 42라고 말했다.
//
// 그래서 세 겹으로 잠근다:
//  · 코퍼스 대조 — 런타임 도달형 수 ↔ **디스크(src/engine/events)의 `reach:` 선언 수**가 같고 0이 아닐 것
//  · 커버리지 — 시나리오 A(전원 만렙 = 발동 상한)는 중학 도달형을 **전량** 띄워야 할 것
//  · 자기검사 — 판정부(auditFires)를 합성 양성/음성 픽스처로 직접 돌려 기대와 다르면 **throw**
// 자기검사는 process.exit이 아니라 throw다 — 마지막 줄을 0으로 박는 뮤테이션에도 살아남는다.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GAME_EVENTS } from '../../src/engine/events/data';
import { getReachForWeek } from '../../src/engine/events/selection';
import type { GameEvent, GameState } from '../../src/engine/types';

const MID_NPCS = ['jihun', 'subin', 'minjae', 'yuna', 'haeun'];
const ALL_NPCS = [...MID_NPCS, 'doyun'];
/** 중학 = getSchoolLevel 기준 Y2~Y4. */
const MID_YEARS = [2, 3, 4];

// ===== 코퍼스 =====

/** 도달형 이벤트(= reach 메타를 가진 이벤트). */
export function reachEventsOf(events: readonly GameEvent[]): GameEvent[] {
  return events.filter((e) => e.reach);
}
/** 이 스크립트가 실제로 재는 대상 — 중학(Y2~4) × MID_NPCS 도달형의 id 집합. */
export function midReachIdsOf(events: readonly GameEvent[]): string[] {
  return reachEventsOf(events)
    .filter((e) => MID_YEARS.includes(e.reach!.year) && MID_NPCS.includes(e.reach!.npc))
    .map((e) => e.id)
    .sort();
}

const EVENTS_DIR = resolve(import.meta.dirname, '../../src/engine/events');
/**
 * 디스크에서 `reach: { ... }` 선언 수를 센다. **런타임 배열과 독립된 두 번째 근거**다 —
 * GAME_EVENTS가 비거나 import가 끊기면 런타임은 0인데 디스크는 그대로라 대조에서 걸린다.
 * (반대로 두 근거가 갈리는 게 정상인 상황은 없다: 도달형은 전부 이 디렉터리에 리터럴로 산다.)
 * 하위 디렉터리까지 내려간다 — 새 파일을 `npc/` 아래에 만들어도 모수에서 빠지지 않게.
 */
export function reachDeclsOnDisk(dir: string = EVENTS_DIR): number {
  let n = 0;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (ent.name !== '__tests__') n += reachDeclsOnDisk(join(dir, ent.name));
      continue;
    }
    if (!ent.name.endsWith('.ts')) continue;
    n += (readFileSync(join(dir, ent.name), 'utf8').match(/\breach\s*:\s*\{/g) ?? []).length;
  }
  return n;
}

/** 코퍼스 건강 판정 — 순수함수. "발동 0건이라 문제 0건"을 통과로 읽지 못하게 한다. */
export function corpusProblems(runtimeReach: number, diskDecls: number, midCount: number): string[] {
  const p: string[] = [];
  if (runtimeReach === 0) p.push('런타임 도달형 0개 — GAME_EVENTS가 비었거나 reach 메타가 전멸했다');
  if (midCount === 0) p.push('중학(Y2~4) 도달형 0개 — 이 스크립트가 잴 대상이 없다(발동 0 = 문제 0 = 거짓 통과)');
  if (runtimeReach !== diskDecls) {
    p.push(`런타임 도달형 ${runtimeReach}개 ≠ 디스크 \`reach:\` 선언 ${diskDecls}개 — 배열에서 빠졌거나 파싱이 좁아졌다`);
  }
  return p;
}

// ===== 쿨다운 =====

export function reachCountOf(events: readonly GameEvent[], npc: string, year: number): number {
  return events.filter((e) => e.reach && e.reach.npc === npc && e.reach.year === year).length;
}
export function cooldownOf(events: readonly GameEvent[], npc: string, year: number): number {
  const c = reachCountOf(events, npc, year);
  return c > 0 ? Math.max(4, Math.round(48 / c)) : 48;
}
const cooldown = (npc: string, year: number) => cooldownOf(GAME_EVENTS, npc, year);

export interface Fire { id: string; npc: string; tier: number; year: number; week: number; abs: number; mode: 'fresh' | 'pre-met'; }

// ===== 판정부 =====

export type PacingProblemKind = 'BURST' | '중복 발동' | '주당 2개+';
export interface PacingProblem { kind: PacingProblemKind; detail: string }

/**
 * 발동 열 → 문제 목록. **순수함수**로 뺀 이유: 실데이터가 상시 0건이라 이 판정부가 통째로
 * 깨져도 관측되지 않는다(초판이 정확히 그 상태였다). 아래 자기검사가 합성 픽스처로 직접 돌린다.
 * 문제를 문자열이 아니라 `kind`로 분류해 두는 것도 자기검사용이다 — 문자열 앞부분만 잘라
 * 비교하면 메시지 포맷을 바꾸는 것만으로 대조군이 조용히 무력화된다.
 */
export function auditFires(
  fires: readonly Fire[],
  cd: (npc: string, year: number) => number,
  npcs: readonly string[] = MID_NPCS,
): PacingProblem[] {
  const problems: PacingProblem[] = [];

  // ③ 1회성
  const seen = new Set<string>();
  for (const f of fires) {
    if (seen.has(f.id)) problems.push({ kind: '중복 발동', detail: `중복 발동: ${f.id}` });
    seen.add(f.id);
  }

  // ② 주당 <=1 (구성상 보장되지만 확인)
  const perWeek = new Map<string, number>();
  for (const f of fires) { const k = `${f.year}-${f.week}`; perWeek.set(k, (perWeek.get(k) ?? 0) + 1); }
  for (const [k, c] of perWeek) if (c > 1) problems.push({ kind: '주당 2개+', detail: `주당 2개+ (${k}): ${c}개` });

  // ① NPC별 연속 간격 — pre-met 발동은 직전 발동과 쿨다운 이상 간격이어야(=burst 없음)
  for (const npc of npcs) {
    const fs = fires.filter((f) => f.npc === npc).sort((a, b) => a.abs - b.abs);
    for (let i = 1; i < fs.length; i++) {
      const gap = fs[i].abs - fs[i - 1].abs;
      const cdw = cd(npc, fs[i].year);
      // fresh는 쿨다운 면제 → fresh 발동엔 간격 검사 제외
      if (fs[i].mode === 'pre-met' && gap < cdw) {
        problems.push({
          kind: 'BURST',
          detail: `BURST: ${npc} ${fs[i - 1].id}(abs${fs[i - 1].abs}) → ${fs[i].id}(abs${fs[i].abs}) 간격 ${gap} < 쿨다운 ${cdw}`,
        });
      }
    }
  }

  return problems;
}

// getReachForWeek가 실제로 읽는 필드만 갖춘 최소 NPC 모양 (NpcState 전체를 채우지 않으므로 별도 정의)
interface SimNpc { id: string; met: boolean; intimacy: number; weekStartIntimacy: number; }

/** 주차별 도달형 선택기. 기본은 제품 함수, 자기검사에서는 합성 구현을 주입한다. */
export type ReachPicker = (state: GameState) => GameEvent | null;

// npcIntim: NPC별 시작 친밀도. growthPerWeek: 주당 친밀도 상승(fresh 경로 테스트용, 0이면 전부 pre-met).
function runScenario(
  npcIntim: Record<string, number>,
  growthPerWeek = 0,
  pick: ReachPicker = getReachForWeek,
  cd: (npc: string, year: number) => number = cooldown,
) {
  const npcs: SimNpc[] = ALL_NPCS.map((id) => ({ id, met: true, intimacy: npcIntim[id] ?? 0, weekStartIntimacy: npcIntim[id] ?? 0 }));
  const state = { year: 2, week: 1, isVacation: false, npcs, events: [] as { id: string; reach: GameState['events'][number]['reach']; year: number; week: number }[] } as unknown as GameState;
  const sim = state as unknown as { year: number; week: number; npcs: SimNpc[]; events: { id: string; reach: unknown; year: number; week: number }[] };
  const fires: Fire[] = [];

  for (let y = 2; y <= 4; y++) {
    for (let w = 1; w <= 48; w++) {
      sim.year = y;
      sim.week = w;
      // processWeek 스냅샷 재현: 주 시작 친밀도 기록 후, 이번 주 성장 반영
      for (const n of sim.npcs) {
        n.weekStartIntimacy = n.intimacy;
        if (growthPerWeek > 0) n.intimacy = Math.min(100, n.intimacy + growthPerWeek);
      }
      const ev = pick(state);
      if (ev && ev.reach) {
        const n = sim.npcs.find((x) => x.id === ev.reach!.npc)!;
        const mode: 'fresh' | 'pre-met' = (n.weekStartIntimacy < ev.reach.tier && n.intimacy >= ev.reach.tier) ? 'fresh' : 'pre-met';
        sim.events.push({ id: ev.id, reach: ev.reach, year: y, week: w });
        fires.push({ id: ev.id, npc: ev.reach.npc, tier: ev.reach.tier, year: y, week: w, abs: (y - 1) * 48 + w, mode });
      }
    }
  }

  return { fires, problems: auditFires(fires, cd) };
}

// ===== 최종 판정부 =====

/**
 * 게이트의 결론을 **한 함수로 모은다**. 코퍼스 대조·커버리지·페이싱을 각각 호출부에 흩어 두면,
 * 실데이터가 상시 정상이라 **그 if 문을 통째로 지워도 초록**이다(초판의 실측 결과가 그랬다:
 * 코퍼스 대조 삭제 SURVIVED / 커버리지 단언 삭제 SURVIVED). 순수함수 하나로 모으면 그 가지들이
 * 아래 자기검사의 합성 양성 대조군 위에 올라가 뮤테이션에 걸린다.
 *
 * severity를 나누는 이유: `gate`는 검사 결과가 아니라 **게이트 자신의 죽음**(잴 게 없다)이라
 * 종료 코드가 아니라 throw로 낸다 — 마지막 줄을 `process.exit(0)`으로 박는 뮤테이션에도 살아남게.
 */
export type GateSeverity = 'gate' | 'content';
export interface GateProblem { severity: GateSeverity; detail: string }
export interface ScenarioResult { name: string; firedIds: readonly string[]; problems: readonly PacingProblem[] }
export interface GateInput {
  runtimeReach: number;
  diskDecls: number;
  midIds: readonly string[];
  /** 첫 번째가 **발동 상한** 시나리오여야 한다(커버리지 기준선). */
  scenarios: readonly ScenarioResult[];
}
export interface Verdict { problems: GateProblem[]; exitCode: 0 | 1 }

export function gateVerdict(inp: GateInput): Verdict {
  const problems: GateProblem[] = [];
  for (const d of corpusProblems(inp.runtimeReach, inp.diskDecls, inp.midIds.length)) {
    problems.push({ severity: 'gate', detail: d });
  }
  if (inp.scenarios.length === 0) {
    problems.push({ severity: 'gate', detail: '시나리오가 0개다 — 아무것도 재지 않았다' });
  }
  for (const sc of inp.scenarios) {
    // 발동 0건은 "문제 없음"이 아니라 미측정이다(#437). 이 게이트가 공허하게 초록이던 정확한 이유.
    if (sc.firedIds.length === 0) {
      problems.push({ severity: 'gate', detail: `시나리오 "${sc.name}" 발동 0건 — 문제 0건은 통과가 아니라 미측정이다` });
    }
    for (const pr of sc.problems) problems.push({ severity: 'content', detail: `${sc.name} — ${pr.detail}` });
  }
  // 커버리지: 첫 시나리오는 전원이 이미 임계를 넘은 **발동 상한**이라 구조적으로 중학 도달형을
  // 전량 띄워야 한다(쿨다운 48/c × c발 = 48주). 빠지면 조건·게이트가 컷을 삭제한 것이다.
  // 학년·NPC당 reach가 13개를 넘으면 48주에 물리적으로 다 못 들어간다 — 그때는 구간으로 바꿀 것.
  const top = inp.scenarios[0];
  if (top) {
    const fired = new Set(top.firedIds);
    const missed = inp.midIds.filter((id) => !fired.has(id));
    if (missed.length > 0) {
      problems.push({
        severity: 'gate',
        detail: `커버리지 미달 — "${top.name}"(발동 상한)가 중학 도달형 ${missed.length}/${inp.midIds.length}개를 못 띄웠다: ${missed.join(', ')}`,
      });
    }
  }
  return { problems, exitCode: problems.length === 0 ? 0 : 1 };
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────
// 합성 양성(결함 있음 → 반드시 잡아야 함)·음성(정상 → 통과) 픽스처를 판정부에 직접 먹인다.
// 실데이터는 문제 0건이라, 이게 없으면 auditFires의 세 검사 중 무엇을 지워도 초록이다.
const CD16 = () => 16;
function fire(id: string, npc: string, abs: number, mode: 'fresh' | 'pre-met' = 'pre-met'): Fire {
  return { id, npc, tier: 50, year: Math.floor((abs - 1) / 48) + 1, week: ((abs - 1) % 48) + 1, abs, mode };
}
const AUDIT_CASES: { label: string; fires: Fire[]; expect: PacingProblemKind[] }[] = [
  { label: '정상 드립(쿨다운 준수)', fires: [fire('a', 'jihun', 1), fire('b', 'jihun', 17), fire('c', 'jihun', 33)], expect: [] },
  { label: 'BURST(간격 4 < 16)', fires: [fire('a', 'jihun', 1), fire('b', 'jihun', 5)], expect: ['BURST'] },
  // fresh 면제 분기의 **음성 대조군**. `mode === 'pre-met'` 가드를 지우면 여기서 BURST가 나 자기검사가 throw.
  { label: 'fresh는 쿨다운 면제', fires: [fire('a', 'jihun', 1), fire('b', 'jihun', 5, 'fresh')], expect: [] },
  { label: '중복 발동', fires: [fire('a', 'jihun', 1), fire('a', 'jihun', 33)], expect: ['중복 발동'] },
  { label: '주당 2개+', fires: [fire('a', 'jihun', 3), fire('b', 'subin', 3)], expect: ['주당 2개+'] },
  // NPC별로 쿨다운을 따로 센다는 음성 대조군 — npc 축을 지우면 여기서 BURST가 난다.
  { label: 'NPC가 다르면 간격 무관', fires: [fire('a', 'jihun', 1), fire('b', 'subin', 2), fire('c', 'minjae', 4)], expect: [] },
];

/** 매주 같은 NPC로 터지는 합성 선택기 — 시뮬레이션 배선(runScenario → auditFires)까지 잠근다. */
const BURST_PICKER: ReachPicker = (s) => ({
  id: `__self_burst_y${s.year}w${s.week}`, title: '', description: '', choices: [],
  reach: { npc: 'jihun', tier: 50, year: s.year },
});
const NULL_PICKER: ReachPicker = () => null;

function runSelfChecks(): number {
  for (const c of AUDIT_CASES) {
    const got = auditFires(c.fires, CD16).map((p) => p.kind).sort();
    const want = [...c.expect].sort();
    if (got.join(' | ') !== want.join(' | ')) {
      throw new Error(`페이싱 자기검사 실패 — "${c.label}": 기대 [${want.join(', ')}] / 실제 [${got.join(', ')}]`);
    }
  }
  if (AUDIT_CASES.filter((c) => c.expect.length > 0).length < 3) {
    throw new Error('페이싱 자기검사 실패 — 합성 양성 대조군이 3종 미만이다(대조군이 지워졌다).');
  }

  // 배선: 시뮬레이터가 판정부를 실제로 부르는가. 순수함수만 잠그면 runScenario가 auditFires를
  // 안 불러도(또는 결과를 버려도) 초록이다.
  const burst = runScenario({ jihun: 100 }, 0, BURST_PICKER, CD16);
  if (burst.fires.length === 0 || burst.problems.length === 0) {
    throw new Error(`페이싱 자기검사 실패 — 매주 터지는 합성 선택기인데 발동 ${burst.fires.length}건/문제 ${burst.problems.length}건이다(시뮬레이터가 판정부를 안 부른다).`);
  }
  const empty = runScenario({ jihun: 100 }, 0, NULL_PICKER, CD16);
  if (empty.fires.length !== 0 || empty.problems.length !== 0) {
    throw new Error('페이싱 자기검사 실패 — 아무것도 안 고르는 선택기인데 발동이 생겼다(시뮬레이터가 픽커를 안 쓴다).');
  }

  // 코퍼스 판정부 — 발동 0 = 문제 0을 통과로 읽지 못하게 하는 축이다.
  const corpusCases: { label: string; args: [number, number, number]; want: number }[] = [
    { label: '정상 코퍼스', args: [96, 96, 42], want: 0 },
    { label: '코퍼스 0 (GAME_EVENTS가 비었다)', args: [0, 96, 0], want: 3 },
    { label: '중학만 전멸', args: [96, 96, 0], want: 1 },
    { label: '런타임↔디스크 불일치', args: [95, 96, 42], want: 1 },
  ];
  for (const c of corpusCases) {
    const got = corpusProblems(...c.args).length;
    if (got !== c.want) throw new Error(`페이싱 자기검사 실패 — 코퍼스 "${c.label}": 기대 ${c.want}건 / 실제 ${got}건`);
  }

  // 최종 판정부 — 코퍼스·커버리지·페이싱 세 가지가 실제로 결론에 반영되는지.
  const okScen: ScenarioResult = { name: 'A', firedIds: ['x', 'y'], problems: [] };
  const burstProblem: PacingProblem = { kind: 'BURST', detail: 'BURST: 합성' };
  const verdictCases: { label: string; input: GateInput; gate: number; content: number; exit: 0 | 1 }[] = [
    { label: '정상', input: { runtimeReach: 96, diskDecls: 96, midIds: ['x', 'y'], scenarios: [okScen] }, gate: 0, content: 0, exit: 0 },
    { label: '코퍼스 0', input: { runtimeReach: 0, diskDecls: 96, midIds: [], scenarios: [{ name: 'A', firedIds: [], problems: [] }] }, gate: 4, content: 0, exit: 1 },
    { label: '발동 0건(문제도 0건)', input: { runtimeReach: 96, diskDecls: 96, midIds: ['x'], scenarios: [{ name: 'A', firedIds: [], problems: [] }] }, gate: 2, content: 0, exit: 1 },
    { label: '커버리지 미달(컷 유실)', input: { runtimeReach: 96, diskDecls: 96, midIds: ['x', 'y'], scenarios: [{ name: 'A', firedIds: ['x'], problems: [] }] }, gate: 1, content: 0, exit: 1 },
    { label: 'burst 발생', input: { runtimeReach: 96, diskDecls: 96, midIds: ['x', 'y'], scenarios: [{ ...okScen, problems: [burstProblem] }] }, gate: 0, content: 1, exit: 1 },
    { label: '시나리오 0개', input: { runtimeReach: 96, diskDecls: 96, midIds: ['x'], scenarios: [] }, gate: 1, content: 0, exit: 1 },
  ];
  for (const c of verdictCases) {
    const v = gateVerdict(c.input);
    const gate = v.problems.filter((x) => x.severity === 'gate').length;
    const content = v.problems.filter((x) => x.severity === 'content').length;
    if (gate !== c.gate || content !== c.content || v.exitCode !== c.exit) {
      throw new Error(
        `페이싱 자기검사 실패 — 최종 판정 "${c.label}": 기대 gate ${c.gate}/content ${c.content}/rc ${c.exit}, `
        + `실제 gate ${gate}/content ${content}/rc ${v.exitCode}`,
      );
    }
  }

  return AUDIT_CASES.length + 2 + corpusCases.length + verdictCases.length;
}

const selfPassed = runSelfChecks();

// ── 실행 ──────────────────────────────────────────────────────────────────────

const runtimeReach = reachEventsOf(GAME_EVENTS).length;
const diskDecls = reachDeclsOnDisk();
const midIds = midReachIdsOf(GAME_EVENTS);

function report(name: string, npcIntim: Record<string, number>, growth = 0): ScenarioResult {
  const { fires, problems } = runScenario(npcIntim, growth);
  console.log(`\n===== ${name} =====`);
  console.log(`시작 친밀도: ${JSON.stringify(npcIntim)}${growth ? ` / 주당 +${growth}` : ''}`);
  console.log(`총 발동: ${fires.length}개 (fresh ${fires.filter(f => f.mode === 'fresh').length} / pre-met ${fires.filter(f => f.mode === 'pre-met').length})`);
  for (const npc of MID_NPCS) {
    const fs = fires.filter((f) => f.npc === npc).sort((a, b) => a.abs - b.abs);
    if (fs.length === 0) continue;
    const gaps = fs.slice(1).map((f, i) => f.abs - fs[i].abs);
    console.log(`  ${npc}: ${fs.length}발 @ ${fs.map(f => `Y${f.year}w${f.week}(t${f.tier})`).join(', ')}  간격[${gaps.join(',')}] (쿨다운16)`);
  }
  if (problems.length) { console.log(`  ❌ 문제 ${problems.length}건:`); problems.forEach(p => console.log(`     - ${p.detail}`)); }
  else console.log('  ✅ burst 없음 / 주당<=1 / 1회성 정상');
  // 발동 0건의 판정은 여기서 하지 않는다 — gateVerdict 한 곳으로 모아 자기검사가 잠근다.
  return { name, firedIds: fires.map((f) => f.id), problems };
}

console.log(`중학 도달형(${midIds.length}개) 페이싱 burst 검증 — getReachForWeek 주차별 상한 호출`);
console.log(`코퍼스: 런타임 도달형 ${runtimeReach}개 = 디스크 \`reach:\` 선언 ${diskDecls}개 / 자기검사 ${selfPassed}종 통과`);
console.log(`쿨다운: 중학 NPC 학년당 ${reachCountOf(GAME_EVENTS, 'yuna', 2)}개 → ${cooldown('yuna', 2)}주 / 하은 Y2 ${reachCountOf(GAME_EVENTS, 'haeun', 2)}개 → ${cooldown('haeun', 2)}주`);

// 시나리오 A는 **발동 상한**(전원 만렙 진입)이라 커버리지 기준선이다 — 반드시 첫 번째로 둘 것.
const scenarios: ScenarioResult[] = [
  // A: 전 NPC 만렙(최악) — Y1에 모두 90+ 쌓고 중학 진입. 전부 pre-met → 드립 분산돼야.
  report('A. 전 NPC 만렙 진입(최악 pre-met)', { jihun: 100, subin: 100, minjae: 100, yuna: 100, haeun: 100 }),
  // B: 유나 올인(과거 burst 재현 케이스) — 나머지 보통
  report('B. 유나 올인 95 진입(과거 burst 케이스)', { yuna: 95, jihun: 40, subin: 40, minjae: 40, haeun: 0 }),
  // C: 점진 성장(fresh 경로) — 0에서 시작해 주당 +1
  report('C. 점진 성장(fresh 경로, 주당+1)', { jihun: 40, subin: 30, minjae: 20, yuna: 30, haeun: 0 }, 1),
];

// 코퍼스·커버리지·페이싱의 결론은 전부 이 한 줄을 지난다. 남은 사각지대는 마지막 줄을
// `process.exit(0)`으로 박는 것 하나이고, 그것도 **content 축(실제 burst)에만** 남는다 —
// 코퍼스 소실·커버리지 미달은 아래에서 throw라 exit 하드코딩이 삼키지 못한다(실측: 아래 표 R13a/R13c).
// verify-background-school-level과 같은 방식으로 표면을 이 한 줄로 좁혀 뒀다.
const verdict = gateVerdict({ runtimeReach, diskDecls, midIds, scenarios });
const gateProblems = verdict.problems.filter((p) => p.severity === 'gate');
const contentProblems = verdict.problems.filter((p) => p.severity === 'content');

if (gateProblems.length > 0) {
  // exit이 아니라 throw — "잴 게 없다"는 검사 결과가 아니라 게이트의 죽음이다.
  throw new Error(`도달형 게이트 이상:\n  - ${gateProblems.map((p) => p.detail).join('\n  - ')}`);
}

const firedTop = new Set(scenarios[0].firedIds);
console.log(`\n커버리지: ${scenarios[0].name}가 중학 도달형 ${firedTop.size}/${midIds.length}개 전량 발동`);
if (contentProblems.length > 0) {
  console.log(`❌ ${contentProblems.length}건 실패`);
  for (const p of contentProblems) console.log(`   - ${p.detail}`);
} else {
  console.log('✅ 전 시나리오 PASS — burst 없음');
}
process.exit(verdict.exitCode);
