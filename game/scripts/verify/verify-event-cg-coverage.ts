// 이벤트 CG 자산 커버리지 검증
// 모든 이벤트의 (선택지 × 성별 × 학년대) 조합에 대해 폴백 cascade 매칭 여부 검사.
// 실행: cd game && npx tsx scripts/verify-event-cg-coverage.ts
//
// CI 게이트 정책: CG는 일부 이벤트에만 붙는 게 정상이라 "전체 미매칭"으로 실패시키면 상시 red다.
// 따라서 전량 커버리지는 정보 리포트로만 출력하고, 실패(exit 1)는 아래 두 축으로 좁힌다.
//  · 필수 CG 세트(생일 P0-B) 누락 → HARD FAIL (지정 세트라 회귀만 잡힘)
//  · 부분 커버(같은 학년대 일부 조합만 CG) → ⚠️ WARN (변형 누락 의심, 검토 권장하나 비치명)
//
// **코퍼스가 0이면 공허하게 초록이 되던 자리** (2026-09-23 실측): GAME_EVENTS를 통째로 비운
// 사본으로 verify 스크립트 34종을 전수 실행했을 때 15종이 정상적으로 rc=1을 냈는데, 이 스크립트는
// rc=0이었다. 원인은 단 하나뿐인 HARD FAIL 축(생일 P0-B)이 `if (!ev || !ev.choices) continue;`로
// **없는 id를 조용히 건너뛴** 것이다 — 이벤트가 0개면 생일 미매칭도 0건이라 "통과"가 된다.
// 지금은 필수 id 부재를 문제로 세고, 코퍼스에서 파생한 생일 명부와 **집합 동등**을 단언한다.
// 그리고 그 판정부를 합성 픽스처로 자기검사한다(아래 SELF_CASES) — 판정부를 지우면 throw다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_EVENTS } from '../../src/engine/events';
import type { EventChoice, GameEvent } from '../../src/engine/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUB = path.join(__dirname, '..', '..', 'public', 'images', 'events');

type SchoolLevel = 'elementary' | 'middle' | 'high' | 'common';
const LEVELS: SchoolLevel[] = ['elementary', 'middle', 'high'];

function fileExists(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

// GameScreen.tsx의 buildCandidates와 동일한 cascade
function cascade(eventId: string, ci: number, gender: 'm' | 'f', sl: SchoolLevel): string[] {
  const dirs: SchoolLevel[] = [sl, 'common'];
  const paths: string[] = [];
  for (const dir of dirs) {
    paths.push(`${dir}/${eventId}_c${ci}_${gender}.png`);
    paths.push(`${dir}/${eventId}_${gender}.png`);
    paths.push(`${dir}/${eventId}_c${ci}.png`);
    paths.push(`${dir}/${eventId}.png`);
  }
  return paths;
}

function findFirstHit(rels: string[]): string | null {
  for (const rel of rels) {
    if (fileExists(path.join(PUB, rel))) return rel;
  }
  return null;
}

// 이벤트 → 학년대 매핑 (조건에서 추론하기 어려우니 휴리스틱)
function inferLevels(eventId: string): SchoolLevel[] {
  if (eventId.startsWith('elementary-') || eventId === 'first-week') return ['elementary'];
  if (eventId.startsWith('middle-') || eventId.startsWith('high-')) {
    return [eventId.startsWith('middle-') ? 'middle' : 'high'];
  }
  // NPC/공용 이벤트는 모든 학년대에서 발동 가능
  return LEVELS;
}

interface Row {
  eventId: string;
  ci: number;
  gender: 'm' | 'f';
  level: SchoolLevel;
  hit: string | null;
}

const rows: Row[] = [];
for (const ev of GAME_EVENTS) {
  if (!ev.choices || ev.choices.length === 0) continue;
  const levels = inferLevels(ev.id);
  for (let ci = 0; ci < ev.choices.length; ci++) {
    for (const g of ['m', 'f'] as const) {
      for (const lv of levels) {
        const hit = findFirstHit(cascade(ev.id, ci, g, lv));
        rows.push({ eventId: ev.id, ci, gender: g, level: lv, hit });
      }
    }
  }
}

// 리포트 본체는 warn-only가 의도된 설계(#292)라 실패로 올리지 않는다. 다만 **조합 0건**은
// 커버리지가 좋은 게 아니라 코퍼스가 사라진 것이다 — 그건 리포트가 아니라 게이트의 죽음이라 막는다.
if (rows.length === 0) {
  throw new Error('CG 커버리지 리포트가 조합 0건을 봤다 — GAME_EVENTS가 비었거나 전 이벤트의 choices가 사라졌다.');
}

const missing = rows.filter(r => r.hit === null);
const total = rows.length;
const found = total - missing.length;

console.log(`\n=== CG 커버리지 (정보 리포트) ===`);
console.log(`총 조합: ${total} / 매칭: ${found} / 미매칭: ${missing.length}`);
console.log(`(대부분의 미매칭은 CG 미지정 이벤트로 정상 — 전량 나열은 생략)`);

// === 부분 커버 경고 (비치명 WARN) ===
// 같은 학년대에서 일부 (선택지×성별) 조합만 CG가 있는 이벤트 = 변형 누락 의심.
// 의도된 부분 CG일 수 있어 빌드는 막지 않되, 작성자 검토용으로 노출한다.
const byLevel = new Map<string, { hit: number; miss: number }>();
const missByLevel = new Map<string, string[]>(); // `${eventId}@${level}` → 미커버 조합(`c{ci}_{g}`) 목록
for (const r of rows) {
  const k = `${r.eventId}@${r.level}`;
  const e = byLevel.get(k) ?? { hit: 0, miss: 0 };
  if (r.hit) { e.hit++; } else {
    e.miss++;
    const m = missByLevel.get(k) ?? [];
    m.push(`c${r.ci}_${r.gender}`);
    missByLevel.set(k, m);
  }
  byLevel.set(k, e);
}
// 의도된 부분 커버 allowlist — `${eventId}@${level}` → 예상 미커버 조합(`c{ci}_{g}`).
// 감사(2026-08) 결과 "옵트아웃/중간 분기엔 CG 미부여"라는 일관된 CG 예산 설계로 확인된 케이스.
// 키만이 아니라 *예상 미커버 조합까지 정확히 일치*할 때만 정상 처리 → allowlist 이벤트가
// 다른 형태로 회귀(에셋 유실·조합 스왑)하거나 신규 갭이 생기면 경고로 잡힌다(codex P2).
//   • 옵트아웃 분기 생략(안 함/미룸/스킵/사양엔 그릴 장면 없음)
//   • c0+c2만 그리고 중간(c1) 생략하는 2-CG 예산
//   • doyun-meet는 남/녀 라우트가 별도 id(…/…-f)라 반대 성별 조합은 상대 이벤트가 커버
const INTENDED_PARTIAL = new Map<string, string[]>([
  // 옵트아웃 분기(마지막 선택지) CG 생략
  ['school-trip-middle@middle', ['c2_f', 'c2_m']],            // c2 "좀 더 생각해볼게"(미룸)
  ['club-academy-choice-y5@high', ['c2_f', 'c2_m']],         // c2 "알아서 할게"(옵트아웃)
  ['doyun-meet-elementary@elementary', ['c0_f', 'c1_f', 'c2_f', 'c2_m']],   // 남 라우트: c2 사양 + 女는 -f가 커버
  ['doyun-meet-elementary-f@elementary', ['c0_m', 'c1_m', 'c2_f', 'c2_m']], // 女 라우트: c2 사양 + 男은 본편이 커버
  ['graduation-prep-elementary@elementary', ['c1_f', 'c1_m']], // c1 "나중에 보면 되지"(스킵)
  ['graduation-prep-high@high', ['c1_f', 'c1_m']],           // c1 "그냥 평소 옷"(간소·스킵)
  // c0+c2만, 중간(c1) 생략하는 2-CG 예산
  ['minjae-honest@middle', ['c1_f', 'c1_m']],               // c1 "집에 안 가?"(가볍게)
  ['minjae-dream@high', ['c1_f', 'c1_m']],                  // c1 "일단 가서 생각해도"(현실적 유보)
  ['junha-cook@high', ['c1_f', 'c1_m']],                    // c1 "대학은 어떻게 할 거야?"(현실적 질문)
  // c1 "말없이 방에 들어간다"(삼킴). 결과화면 c1도 의도적으로 CG 없음(이웃 3건과 같은 2-CG 예산) +
  // memorySlotDraft가 없어 회상엔 애초에 못 뜬다. 두 축 모두 의도.
  ['adolescence-clash@middle', ['c1_f', 'c1_m']],
]);

// 실제 미커버 조합이 예상과 정확히 같은가(회귀/스왑/신규 갭 감지).
function matchesIntended(k: string): boolean {
  const expected = INTENDED_PARTIAL.get(k);
  if (!expected) return false;
  const actual = [...(missByLevel.get(k) ?? [])].sort();
  const exp = [...expected].sort();
  return actual.length === exp.length && actual.every((v, i) => v === exp[i]);
}

const partialAll = [...byLevel.entries()].filter(([, v]) => v.hit > 0 && v.miss > 0).sort();
const intended = partialAll.filter(([k]) => matchesIntended(k));
const partial = partialAll.filter(([k]) => !matchesIntended(k));
if (intended.length > 0) {
  console.log(`\nℹ️  의도된 부분 커버 (${intended.length}건 — allowlist 일치, 정상): ${intended.map(([k]) => k).join(', ')}`);
}
if (partial.length > 0) {
  console.warn(`\n⚠️  부분 커버 경고 (${partial.length}건 — 신규 변형 누락/회귀 의심, 검토 권장):`);
  for (const [k, v] of partial) {
    const tag = INTENDED_PARTIAL.has(k) ? ' [allowlist와 조합 불일치 — 회귀 의심]' : '';
    console.warn(`   ${k} → ${v.hit}/${v.hit + v.miss} 커버 (미커버: ${[...(missByLevel.get(k) ?? [])].sort().join(',')})${tag}`);
  }
}

// === 필수 CG 세트 검증 (HARD FAIL 대상) ===
// 생일 이벤트(P0-B): CG가 반드시 존재해야 하는 지정 세트. 이 세트 누락 시에만 CI 실패시킨다.
// (커버리지 전량은 위 리포트로 관측 — 구조적 부분 커버로 인한 상시 red 방지)

/** CG가 **전 선택지에** 있어야 하는 필수 세트(P0-B). */
export const REQUIRED_BIRTHDAY_IDS = [
  'minjae-birthday', 'jihun-birthday', 'subin-birthday', 'yuna-birthday',
] as const;
/**
 * 생일 이벤트지만 CG 예산 밖 — `public/images/events/**`에 자산이 하나도 없다(2026-09-23 실측).
 *
 * 이건 면제 목록이 아니라 **명부의 반쪽**이다. 아래 판정부는 (필수 ∪ 예산밖)과 코퍼스에서 뽑은
 * 생일 이벤트 집합이 **정확히 같은지**를 본다 — "필수 4종이 N개 이상 있나"로 두면 4종이 통째로
 * 사라져도(코퍼스 0) 통과한다. 새 생일 이벤트가 생기면 둘 중 어디에 넣을지 정할 때까지 빨개진다.
 */
export const CG_EXEMPT_BIRTHDAY_IDS = ['junha-birthday', 'haeun-birthday'] as const;
/** 코퍼스에서 생일 이벤트를 알아보는 규칙. 이 규칙의 결과와 위 명부가 같은 집합이어야 한다. */
const BIRTHDAY_ID_RE = /-birthday$/;
/** 생일 이벤트가 최소한 가져야 할 분기 수(선물 / 그냥 넘어감). PASS 주장의 하한 계산에만 쓴다. */
const MIN_CHOICES_PER_BIRTHDAY = 2;

/** (이벤트 id, 선택지 index) → 매칭된 CG 경로 또는 null. 자기검사에서 합성 구현을 주입한다. */
export type CgHit = (eventId: string, ci: number) => string | null;

type BirthdayProblemKind = '명부 불일치' | 'id 없음' | '선택지 없음' | 'CG 없음';
/**
 * `gate` = 잴 대상 자체가 사라졌다(코퍼스가 비거나 id가 증발) / `content` = 그릴 게 안 그려졌다.
 * gate는 종료 코드가 아니라 **throw**로 낸다 — 마지막 줄을 `process.exit(0)`으로 박는 뮤테이션에도
 * "코퍼스가 0인데 초록"이 되살아나지 못하게. (content는 기존대로 ❌ 출력 + exit 1.)
 */
export type BirthdayProblemSeverity = 'gate' | 'content';
export function severityOf(kind: BirthdayProblemKind): BirthdayProblemSeverity {
  return kind === 'CG 없음' ? 'content' : 'gate';
}
export interface BirthdayProblem { kind: BirthdayProblemKind; subject: string; detail: string }
export interface BirthdayAudit {
  problems: BirthdayProblem[];
  rows: { eventId: string; ci: number; text: string; hit: string | null }[];
  checkedEvents: number;
}

/**
 * 필수 CG 세트 판정 — **순수함수**. 코퍼스와 CG 조회를 둘 다 인자로 받는다.
 * 순수함수로 뺀 이유는 하나뿐이다: 실데이터가 상시 0건이라 **실패 경로가 한 번도 실행되지
 * 않아서**, 판정부가 깨져도 아무도 모른다. 아래 자기검사가 합성 코퍼스로 이 함수를 직접 돌린다.
 */
export function auditRequiredBirthdayCg(events: readonly GameEvent[], hit: CgHit): BirthdayAudit {
  const problems: BirthdayProblem[] = [];
  const rows: BirthdayAudit['rows'] = [];

  // ① 명부 집합 동등 — 코퍼스가 비면(또는 id가 개명되면) 여기서 먼저 걸린다.
  const roster: string[] = [...REQUIRED_BIRTHDAY_IDS, ...CG_EXEMPT_BIRTHDAY_IDS].sort();
  const found = events.filter(e => BIRTHDAY_ID_RE.test(e.id)).map(e => e.id).sort();
  if (found.join('|') !== roster.join('|')) {
    const lost = roster.filter(id => !found.includes(id));
    const extra = found.filter(id => !roster.includes(id));
    problems.push({
      kind: '명부 불일치',
      subject: '(명부)',
      detail: `코퍼스의 생일 이벤트 [${found.join(', ') || '없음'}] ≠ 명부 [${roster.join(', ')}]`
        + (lost.length ? ` / 코퍼스에서 사라짐: ${lost.join(', ')}` : '')
        + (extra.length ? ` / 명부에 없는 신규: ${extra.join(', ')}` : ''),
    });
  }

  // ② 필수 세트 — 없는 id를 `continue`로 건너뛰지 않는다. 그게 공허한 초록의 원인이었다.
  let checkedEvents = 0;
  for (const eid of REQUIRED_BIRTHDAY_IDS) {
    const ev = events.find(e => e.id === eid);
    if (!ev) {
      problems.push({ kind: 'id 없음', subject: eid, detail: `${eid} — 필수 CG 세트인데 코퍼스에 없다(삭제·개명?)` });
      continue;
    }
    if (!ev.choices || ev.choices.length === 0) {
      problems.push({ kind: '선택지 없음', subject: eid, detail: `${eid} — 선택지가 0개라 검사할 분기가 없다` });
      continue;
    }
    checkedEvents++;
    for (let ci = 0; ci < ev.choices.length; ci++) {
      const h = hit(eid, ci);
      rows.push({ eventId: eid, ci, text: ev.choices[ci].text, hit: h });
      if (!h) problems.push({ kind: 'CG 없음', subject: `${eid} c${ci}`, detail: `${eid} c${ci} — 매칭되는 CG 파일이 없다` });
    }
  }
  return { problems, rows, checkedEvents };
}

/**
 * problems → 종료 코드. 별도 함수인 이유는 verify-background-school-level과 같다 —
 * 실패 경로가 실데이터로는 안 돌아서, 이 변환이 깨져도 관측되지 않는다. 자기검사가 잠근다.
 */
export function exitCodeFor(problems: readonly BirthdayProblem[]): 0 | 1 {
  return problems.length === 0 ? 0 : 1;
}

/**
 * **PASS를 주장하려면 실제로 이만큼은 봤어야 한다**는 하한. 하한은 리터럴이 아니라 명부에서
 * 파생한다(필수 종수 × 최소 분기). 이것도 순수함수로 빼 둔다 — 실데이터로는 절대 안 걸리는
 * 경로라, 인라인으로 두면 지워도 아무도 모른다.
 */
export function coverageFloorError(checkedEvents: number, branchCount: number): string | null {
  const floor = REQUIRED_BIRTHDAY_IDS.length * MIN_CHOICES_PER_BIRTHDAY;
  if (checkedEvents !== REQUIRED_BIRTHDAY_IDS.length || branchCount < floor) {
    return `필수 CG 커버리지 하한 미달 — 검사한 이벤트 ${checkedEvents}/${REQUIRED_BIRTHDAY_IDS.length}, 분기 ${branchCount}/${floor}. `
      + '문제 0건인데 본 게 없다 = 판정부가 아니라 코퍼스가 사라진 것이다.';
  }
  return null;
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────
// 합성 픽스처로 판정부를 직접 돌린다. 실패는 process.exit이 아니라 **throw** —
// 마지막 줄의 `process.exit(...)`를 지우거나 0으로 박는 뮤테이션에도 살아남는다.
function mkChoice(text: string): EventChoice {
  return { text, effects: {}, message: '' };
}
function mkBirthday(id: string, n = 3): GameEvent {
  return { id, title: id, description: '', choices: Array.from({ length: n }, (_, i) => mkChoice(`${id} c${i}`)) };
}
const FULL_ROSTER: GameEvent[] = [...REQUIRED_BIRTHDAY_IDS, ...CG_EXEMPT_BIRTHDAY_IDS].map(id => mkBirthday(id));
const ALL_HIT: CgHit = (eid, ci) => `synthetic/${eid}_c${ci}.png`;
const MISS_ONE: CgHit = (eid, ci) => (eid === 'minjae-birthday' && ci === 1 ? null : ALL_HIT(eid, ci));

const SELF_CASES: { label: string; events: GameEvent[]; hit: CgHit; expect: string[] }[] = [
  { label: '정상 명부 + 전 분기 CG', events: FULL_ROSTER, hit: ALL_HIT, expect: [] },
  // 이 게이트가 실제로 공허하게 초록이던 상태. 지금은 명부 불일치 + 필수 4종 부재 = 5건.
  {
    label: '코퍼스 0 (GAME_EVENTS가 비었다)', events: [], hit: ALL_HIT,
    expect: ['id 없음@jihun-birthday', 'id 없음@minjae-birthday', 'id 없음@subin-birthday', 'id 없음@yuna-birthday', '명부 불일치@(명부)'],
  },
  // 개수가 6개 그대로라 "N개 이상" 식 하한으로는 절대 안 잡히는 변형.
  {
    label: '필수 id 개명(개수는 그대로)',
    events: FULL_ROSTER.map(e => (e.id === 'yuna-birthday' ? mkBirthday('yuna2-birthday') : e)),
    hit: ALL_HIT,
    expect: ['id 없음@yuna-birthday', '명부 불일치@(명부)'],
  },
  {
    label: '필수 id 삭제', events: FULL_ROSTER.filter(e => e.id !== 'subin-birthday'), hit: ALL_HIT,
    expect: ['id 없음@subin-birthday', '명부 불일치@(명부)'],
  },
  { label: 'CG 한 장 유실', events: FULL_ROSTER, hit: MISS_ONE, expect: ['CG 없음@minjae-birthday c1'] },
  {
    label: '필수 이벤트의 선택지가 0개',
    events: FULL_ROSTER.map(e => (e.id === 'jihun-birthday' ? { ...e, choices: [] } : e)),
    hit: ALL_HIT,
    expect: ['선택지 없음@jihun-birthday'],
  },
  {
    label: '명부에 없는 새 생일 이벤트', events: [...FULL_ROSTER, mkBirthday('sora-birthday')], hit: ALL_HIT,
    expect: ['명부 불일치@(명부)'],
  },
];

function runSelfChecks(): number {
  for (const c of SELF_CASES) {
    const got = auditRequiredBirthdayCg(c.events, c.hit).problems.map(p => `${p.kind}@${p.subject}`).sort();
    const want = [...c.expect].sort();
    if (got.join(' | ') !== want.join(' | ')) {
      throw new Error(`생일 CG 자기검사 실패 — "${c.label}": 기대 [${want.join(', ')}] / 실제 [${got.join(', ')}]`);
    }
  }
  // 픽스처 자체가 판정부와 어긋나 있으면 위 비교는 의미가 없다 — 합성 양성이 실제로 양성인지 본다.
  if (SELF_CASES.filter(c => c.expect.length > 0).length < 5) {
    throw new Error('생일 CG 자기검사 실패 — 합성 양성 대조군이 5종 미만이다(대조군이 지워졌다).');
  }
  if (exitCodeFor([]) !== 0 || exitCodeFor(auditRequiredBirthdayCg([], ALL_HIT).problems) !== 1) {
    throw new Error('생일 CG 자기검사 실패 — 문제를 찾고도 종료 코드가 0이다(실패가 CI에 전달되지 않는다).');
  }
  // 커버리지 하한 — (검사 종수, 분기 수) → 통과/미달. 실데이터로는 절대 안 걸리는 경로다.
  const floorCases: { label: string; args: [number, number]; pass: boolean }[] = [
    { label: '정상 (4종 13분기)', args: [REQUIRED_BIRTHDAY_IDS.length, 13], pass: true },
    { label: '검사 0건', args: [0, 0], pass: false },
    { label: '분기만 말라붙음', args: [REQUIRED_BIRTHDAY_IDS.length, 4], pass: false },
    { label: '한 종 누락', args: [REQUIRED_BIRTHDAY_IDS.length - 1, 13], pass: false },
  ];
  for (const c of floorCases) {
    if ((coverageFloorError(...c.args) === null) !== c.pass) {
      throw new Error(`생일 CG 자기검사 실패 — 커버리지 하한 "${c.label}"의 판정이 뒤집혔다.`);
    }
  }
  // 심각도 — 코퍼스 소실(gate)과 자산 유실(content)이 섞이면 exit 하드코딩 한 줄로 둘 다 삼켜진다.
  const sevCases: [BirthdayProblemKind, BirthdayProblemSeverity][] = [
    ['명부 불일치', 'gate'], ['id 없음', 'gate'], ['선택지 없음', 'gate'], ['CG 없음', 'content'],
  ];
  for (const [kind, want] of sevCases) {
    if (severityOf(kind) !== want) {
      throw new Error(`생일 CG 자기검사 실패 — "${kind}"의 심각도가 ${severityOf(kind)}다(기대 ${want}).`);
    }
  }
  return SELF_CASES.length + 1 + floorCases.length + sevCases.length;
}

const selfPassed = runSelfChecks();

// ── 실행 ──────────────────────────────────────────────────────────────────────
console.log(`\n=== 필수 CG: 생일 이벤트 (P0-B) ===`);
const bday = auditRequiredBirthdayCg(
  GAME_EVENTS,
  (eid, ci) => findFirstHit(cascade(eid, ci, 'm', 'elementary')),
);
for (const r of bday.rows) {
  console.log(`  [${r.eventId} c${r.ci}] "${r.text.slice(0, 30)}…" → ${r.hit ? `✓ ${r.hit}` : '✗ 미매칭'}`);
}
console.log(`  명부 ${REQUIRED_BIRTHDAY_IDS.length + CG_EXEMPT_BIRTHDAY_IDS.length}종 중 필수 ${REQUIRED_BIRTHDAY_IDS.length}종 / CG 예산 밖 ${CG_EXEMPT_BIRTHDAY_IDS.length}종(${CG_EXEMPT_BIRTHDAY_IDS.join(', ')})`);
console.log(`  자기검사 ${selfPassed}종 통과 (합성 양성 ${SELF_CASES.filter(c => c.expect.length > 0).length}종 포함)`);

// PASS를 주장하려면 **실제로 이만큼은 봤어야 한다**. "검사 0건인데 ✅ PASS"가 이 스크립트에서
// 실제로 재현된 실패 유형이다(문제 0건일 때만 본다 — 진짜 결함이 있으면 아래 ❌가 이유를 말해야 하니까).
if (bday.problems.length === 0) {
  const floorErr = coverageFloorError(bday.checkedEvents, bday.rows.length);
  if (floorErr) throw new Error(floorErr);
}

console.log(`\n생일 미매칭 분기: ${bday.rows.filter(r => !r.hit).length} (검사 ${bday.rows.length}분기 / 필수 ${bday.checkedEvents}종)`);
if (bday.problems.length > 0) {
  console.error(`\n❌ 필수 CG(생일 P0-B) 결함 ${bday.problems.length}건 — CI 실패 처리`);
  for (const p of bday.problems) console.error(`   [${p.kind}] ${p.detail}`);
} else {
  console.log(`✅ 필수 CG(생일 P0-B) 정상 — 명부 동등 + 전 분기 매칭`);
}

// 코퍼스가 사라진 것(gate)은 검사 결과가 아니라 게이트의 죽음이다 — exit이 아니라 throw.
const gateProblems = bday.problems.filter(p => severityOf(p.kind) === 'gate');
if (gateProblems.length > 0) {
  throw new Error(`생일 CG 게이트 이상:\n  - ${gateProblems.map(p => p.detail).join('\n  - ')}`);
}
// 남은 사각지대는 이 한 줄을 `process.exit(0)`으로 박는 것 하나이고, 그것도 **자산 유실 축에만**
// 남는다 — 코퍼스 소실(명부 불일치·id 없음)은 위에서 throw라 exit 하드코딩이 삼키지 못한다(실측 C7a).
process.exit(exitCodeFor(bday.problems));
