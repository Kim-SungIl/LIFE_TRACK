// verify-reach-pacing.ts — 중학 도달형 42개 페이싱(burst 방지) 검증
// getReachForWeek를 Y2~Y4 전 주차에 호출해(= reach 발동 상한) 측정:
//  ① NPC별 연속 발동 간격 >= 쿨다운(16주, pre-met) — burst 없음
//  ② 주당 reach <= 1
//  ③ 이벤트 영구 1회성(중복 발동 없음)
//  ④ 커버리지(학년 게이트 내 발동 수) — 정보용. year===N 컷 유실은 의도된 설계.
// 실제 게임은 reach가 conditional 풀에서 50% 등으로 더 느리게 뜨므로, 이 sim은 최악(상한) 케이스다.

import { GAME_EVENTS } from '../../src/engine/events/data';
import { getReachForWeek } from '../../src/engine/events/selection';
import type { GameState } from '../../src/engine/types';

const MID_NPCS = ['jihun', 'subin', 'minjae', 'yuna', 'haeun'];
const ALL_NPCS = [...MID_NPCS, 'doyun'];

function reachCount(npc: string, year: number): number {
  return GAME_EVENTS.filter((e) => e.reach && e.reach.npc === npc && e.reach.year === year).length;
}
function cooldown(npc: string, year: number): number {
  const c = reachCount(npc, year);
  return c > 0 ? Math.max(4, Math.round(48 / c)) : 48;
}

interface Fire { id: string; npc: string; tier: number; year: number; week: number; abs: number; mode: 'fresh' | 'pre-met'; }

// getReachForWeek가 실제로 읽는 필드만 갖춘 최소 NPC 모양 (NpcState 전체를 채우지 않으므로 별도 정의)
interface SimNpc { id: string; met: boolean; intimacy: number; weekStartIntimacy: number; }

// npcIntim: NPC별 시작 친밀도. growthPerWeek: 주당 친밀도 상승(fresh 경로 테스트용, 0이면 전부 pre-met).
function runScenario(name: string, npcIntim: Record<string, number>, growthPerWeek = 0) {
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
      const ev = getReachForWeek(state);
      if (ev && ev.reach) {
        const n = sim.npcs.find((x) => x.id === ev.reach!.npc)!;
        const mode: 'fresh' | 'pre-met' = (n.weekStartIntimacy < ev.reach.tier && n.intimacy >= ev.reach.tier) ? 'fresh' : 'pre-met';
        sim.events.push({ id: ev.id, reach: ev.reach, year: y, week: w });
        fires.push({ id: ev.id, npc: ev.reach.npc, tier: ev.reach.tier, year: y, week: w, abs: (y - 1) * 48 + w, mode });
      }
    }
  }

  // ===== 검증 =====
  const problems: string[] = [];

  // ③ 1회성
  const seen = new Set<string>();
  for (const f of fires) { if (seen.has(f.id)) problems.push(`중복 발동: ${f.id}`); seen.add(f.id); }

  // ② 주당 <=1 (구성상 보장되지만 확인)
  const perWeek = new Map<string, number>();
  for (const f of fires) { const k = `${f.year}-${f.week}`; perWeek.set(k, (perWeek.get(k) ?? 0) + 1); }
  for (const [k, c] of perWeek) if (c > 1) problems.push(`주당 2개+ (${k}): ${c}개`);

  // ① NPC별 연속 간격 — pre-met 발동은 직전 발동과 쿨다운 이상 간격이어야(=burst 없음)
  for (const npc of MID_NPCS) {
    const fs = fires.filter((f) => f.npc === npc).sort((a, b) => a.abs - b.abs);
    for (let i = 1; i < fs.length; i++) {
      const gap = fs[i].abs - fs[i - 1].abs;
      const cd = cooldown(npc, fs[i].year);
      // fresh는 쿨다운 면제 → fresh 발동엔 간격 검사 제외
      if (fs[i].mode === 'pre-met' && gap < cd) {
        problems.push(`BURST: ${npc} ${fs[i - 1].id}(abs${fs[i - 1].abs}) → ${fs[i].id}(abs${fs[i].abs}) 간격 ${gap} < 쿨다운 ${cd}`);
      }
    }
  }

  return { fires, problems };
}

function report(name: string, npcIntim: Record<string, number>, growth = 0) {
  const { fires, problems } = runScenario(name, npcIntim, growth);
  console.log(`\n===== ${name} =====`);
  console.log(`시작 친밀도: ${JSON.stringify(npcIntim)}${growth ? ` / 주당 +${growth}` : ''}`);
  console.log(`총 발동: ${fires.length}개 (fresh ${fires.filter(f => f.mode === 'fresh').length} / pre-met ${fires.filter(f => f.mode === 'pre-met').length})`);
  for (const npc of MID_NPCS) {
    const fs = fires.filter((f) => f.npc === npc).sort((a, b) => a.abs - b.abs);
    if (fs.length === 0) continue;
    const gaps = fs.slice(1).map((f, i) => f.abs - fs[i].abs);
    console.log(`  ${npc}: ${fs.length}발 @ ${fs.map(f => `Y${f.year}w${f.week}(t${f.tier})`).join(', ')}  간격[${gaps.join(',')}] (쿨다운16)`);
  }
  if (problems.length) { console.log(`  ❌ 문제 ${problems.length}건:`); problems.forEach(p => console.log(`     - ${p}`)); }
  else console.log('  ✅ burst 없음 / 주당<=1 / 1회성 정상');
  return problems.length;
}

console.log('중학 도달형(42개) 페이싱 burst 검증 — getReachForWeek 주차별 상한 호출');
console.log(`쿨다운: 중학 NPC 학년당 ${reachCount('yuna', 2)}개 → ${cooldown('yuna', 2)}주 / 하은 Y2 ${reachCount('haeun', 2)}개 → ${cooldown('haeun', 2)}주`);

let fail = 0;
// 시나리오 A: 전 NPC 만렙(최악) — Y1에 모두 90+ 쌓고 중학 진입. 전부 pre-met → 드립 분산돼야.
fail += report('A. 전 NPC 만렙 진입(최악 pre-met)', { jihun: 100, subin: 100, minjae: 100, yuna: 100, haeun: 100 });
// 시나리오 B: 유나 올인(과거 burst 재현 케이스) — 나머지 보통
fail += report('B. 유나 올인 95 진입(과거 burst 케이스)', { yuna: 95, jihun: 40, subin: 40, minjae: 40, haeun: 0 });
// 시나리오 C: 점진 성장(fresh 경로) — 0에서 시작해 주당 +1
fail += report('C. 점진 성장(fresh 경로, 주당+1)', { jihun: 40, subin: 30, minjae: 20, yuna: 30, haeun: 0 }, 1);

console.log(`\n${fail === 0 ? '✅ 전 시나리오 PASS — burst 없음' : `❌ ${fail}건 실패`}`);
process.exit(fail === 0 ? 0 : 1);
