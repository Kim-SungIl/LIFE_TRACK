// record-weekly-golden.ts — 주 진행 드라이버의 골든을 기록한다(월 단위 계획 1단계).
//
// **기준은 화면의 현행 확정 순서(`confirmInline`)다.** 이 스크립트는 의도적으로 동작이 바뀐
// 변경(예: 월초 용돈)에서만 다시 돌린다. 다시 돌렸다면 테스트 파일 머리 주석에 원인 귀속을 적는다
// (romanceInvariance.test.ts와 같은 규약 — "무엇을 되돌리면 바이트 동일로 돌아오는가").
//
// 실행: cd game && npx tsx scripts/sim/record-weekly-golden.ts
//       같은 걸 두 번 돌려 파일이 안 바뀌는지 보면 결정론 확인이 된다.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GOLDEN_FILE, GOLDEN_PERSONAS, GOLDEN_SEEDS, confirmInline, driveGame, installMemoryStorage, type WeeklyGolden,
} from '../lib/week-driver';

installMemoryStorage();
const { useGameStore } = await import('../../src/engine/store');

const runs: WeeklyGolden['runs'] = [];
for (const persona of GOLDEN_PERSONAS) {
  for (const seed of GOLDEN_SEEDS) {
    const t0 = Date.now();
    const r = driveGame(useGameStore, persona, seed, confirmInline);
    if (!r.reachedEnding) throw new Error(`${persona.name}/${seed}: 엔딩에 못 닿았다 — 골든을 쓰지 않는다`);
    runs.push({ persona: persona.name, seed, digests: r.digests, coreDigests: r.coreDigests, counters: r.counters });
    console.log(`${persona.name}/seed${seed}: ${r.digests.length}칸 · ${Date.now() - t0}ms ·`, JSON.stringify(r.counters));
  }
}

const sourceCommit = execSync('git rev-parse --short HEAD').toString().trim();
const golden: WeeklyGolden = {
  sourceCommit,
  note: '매 계획 시점(확정 직전)의 store 상태 지문. 기준 확정 순서 = confirmInline(GameScreen onConfirmWeek 현행).',
  runs,
};
const out = resolve(import.meta.dirname, '../..', GOLDEN_FILE);
writeFileSync(out, JSON.stringify(golden, null, 1) + '\n');
console.log(`→ ${GOLDEN_FILE} (${runs.length}판, 기준 ${sourceCommit})`);
