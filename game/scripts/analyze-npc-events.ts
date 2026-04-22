// NPC별 이벤트 분석
// - 각 NPC의 이벤트 개수, intimacyChange 합계/최대/평균
// - 후속 이벤트별 조건 (친밀도 요구치, 주차)
//
// 실행: npx tsx scripts/analyze-npc-events.ts

import { GAME_EVENTS } from '../src/engine/events';

const NPC_IDS = ['jihun', 'subin', 'minjae', 'yuna', 'haeun', 'junha'];

interface NpcEventInfo {
  id: string;
  title: string;
  week?: number;
  maxIntimacy: number;  // 최대 intimacyChange
  minIntimacy: number;  // 최소
  sumBest: number;      // 가장 우호적 선택시 얻는 값
  conditionStr: string; // 조건 함수 텍스트 (대충)
}

const byNpc: Record<string, NpcEventInfo[]> = {};
for (const npc of NPC_IDS) byNpc[npc] = [];

for (const event of GAME_EVENTS) {
  const allNpcsInEvent = new Set<string>();

  // speakers
  if (event.speakers) for (const s of event.speakers) allNpcsInEvent.add(s);

  // choices + femaleChoices의 npcEffects
  const allChoices = [...event.choices, ...(event.femaleChoices || [])];
  const intimacyByNpc: Record<string, number[]> = {};
  for (const npc of NPC_IDS) intimacyByNpc[npc] = [];

  for (const c of allChoices) {
    if (c.npcEffects) for (const ne of c.npcEffects) {
      if (NPC_IDS.includes(ne.npcId)) {
        allNpcsInEvent.add(ne.npcId);
        intimacyByNpc[ne.npcId].push(ne.intimacyChange);
      }
    }
  }

  // condition 텍스트 추출
  const condStr = event.condition ? event.condition.toString().replace(/\s+/g, ' ').slice(0, 150) : '(없음)';

  for (const npcId of allNpcsInEvent) {
    const changes = intimacyByNpc[npcId];
    if (changes.length === 0) {
      byNpc[npcId].push({
        id: event.id, title: event.title, week: event.week,
        maxIntimacy: 0, minIntimacy: 0, sumBest: 0,
        conditionStr: condStr,
      });
      continue;
    }
    byNpc[npcId].push({
      id: event.id, title: event.title, week: event.week,
      maxIntimacy: Math.max(...changes),
      minIntimacy: Math.min(...changes),
      sumBest: Math.max(...changes),
      conditionStr: condStr,
    });
  }
}

console.log('NPC별 이벤트 현황\n');
for (const npc of NPC_IDS) {
  const list = byNpc[npc];
  const total = list.reduce((acc, e) => acc + e.sumBest, 0);
  const positiveEvents = list.filter(e => e.maxIntimacy > 0).length;
  console.log(`\n===== ${npc} (${list.length}개 이벤트, 최적선택시 총 +${total} intimacy) =====`);
  for (const e of list.sort((a, b) => (a.week ?? 99) - (b.week ?? 99))) {
    const w = e.week ? `W${e.week}` : '랜덤';
    const im = e.maxIntimacy >= 0 ? `+${e.maxIntimacy}` : `${e.maxIntimacy}`;
    const badge = e.maxIntimacy >= 10 ? '🔥' : e.maxIntimacy >= 6 ? '' : ' ';
    console.log(`  ${badge} ${w.padEnd(6)} ${e.id.padEnd(32)} max=${im.padStart(3)}  cond: ${e.conditionStr.slice(0, 80)}`);
  }
}

console.log('\n\n===== NPC별 intimacy 경제 =====');
console.log('NPC      | 이벤트수 | max값≥10 | max값≥6 | max값≥3 | 최적 총합');
for (const npc of NPC_IDS) {
  const list = byNpc[npc];
  const total = list.reduce((acc, e) => acc + e.sumBest, 0);
  const big = list.filter(e => e.maxIntimacy >= 10).length;
  const med = list.filter(e => e.maxIntimacy >= 6).length;
  const small = list.filter(e => e.maxIntimacy >= 3).length;
  console.log(`${npc.padEnd(9)}| ${String(list.length).padStart(8)} | ${String(big).padStart(8)} | ${String(med).padStart(7)} | ${String(small).padStart(7)} | ${String(total).padStart(9)}`);
}
