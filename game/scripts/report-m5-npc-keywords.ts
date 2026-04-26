// M5 NPC 체감 리포트
// 목적: 사용자가 7년 플레이 안 해도 "각 NPC와 관계가 어떻게 쌓이는지" 키워드로 확인
//
// 5개 플레이 패턴 × 6개 NPC별로:
// - 친밀도 주차 궤적 (피크/저점 타임스탬프)
// - 발동한 NPC 관련 이벤트 타임라인 + 선택한 메시지
// - memorySlot recallText (NPC 관련)
// - 엔딩 근황 문구 (getTopNpcStories)
//
// 실행: cd game && npx tsx scripts/report-m5-npc-keywords.ts

import { createInitialState, processWeek, calculateEnding } from '../src/engine/gameEngine';
import { applyMemorySlotFromChoice } from '../src/engine/memorySystem';
import { getFollowupForWeek } from '../src/engine/events';
import type { GameState, ParentStrength } from '../src/engine/types';

interface Pattern {
  name: string;
  parents: [ParentStrength, ParentStrength];
  gender: 'male' | 'female';
  routine2: string;
  routine3: string;
  choicePolicy: (state: GameState) => number;
}

const PATTERNS: Pattern[] = [
  {
    name: '학업형 (학업 중시)',
    parents: ['info', 'strict'], gender: 'male',
    routine2: 'self-study', routine3: 'academy',
    choicePolicy: (s) => {
      const e = s.currentEvent; if (!e) return 0;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      let best = 0, bs = -999;
      choices.forEach((c, i) => { const sc = (c.effects.academic ?? 0) * 3 + (c.effects.mental ?? 0); if (sc > bs) { bs = sc; best = i; } });
      return best;
    },
  },
  {
    name: '인기형 (사교 중시)',
    parents: ['emotional', 'freedom'], gender: 'female',
    routine2: 'club-activity', routine3: 'part-time-job',
    choicePolicy: (s) => {
      const e = s.currentEvent; if (!e) return 0;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      let best = 0, bs = -999;
      choices.forEach((c, i) => {
        const sc = (c.effects.social ?? 0) * 3 + (c.effects.mental ?? 0)
          + (c.npcEffects?.reduce((acc, n) => acc + n.intimacyChange, 0) ?? 0);
        if (sc > bs) { bs = sc; best = i; }
      });
      return best;
    },
  },
  {
    name: '관계형 (화해·소통 선호)',
    parents: ['emotional', 'wealth'], gender: 'male',
    routine2: 'self-study', routine3: 'basketball',
    choicePolicy: (s) => {
      const e = s.currentEvent; if (!e) return 0;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      // 화해/공감/솔직함 선호: intimacyChange 총합 최댓값
      let best = 0, bs = -999;
      choices.forEach((c, i) => {
        const sc = (c.npcEffects?.reduce((acc, n) => acc + n.intimacyChange, 0) ?? 0)
          + (c.effects.social ?? 0);
        if (sc > bs) { bs = sc; best = i; }
      });
      return best;
    },
  },
  {
    name: '밸런스 (첫 선택지)',
    parents: ['wealth', 'emotional'], gender: 'male',
    routine2: 'self-study', routine3: 'basketball',
    choicePolicy: () => 0,
  },
  {
    name: '회피형 (돈·피로 최소)',
    parents: ['strict', 'info'], gender: 'female',
    routine2: 'self-study', routine3: 'academy',
    choicePolicy: (s) => {
      const e = s.currentEvent; if (!e) return 0;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      let best = 0, bs = -999;
      choices.forEach((c, i) => {
        const sc = -(c.moneyEffect ?? 0) - (c.fatigueEffect ?? 0);
        if (sc > bs) { bs = sc; best = i; }
      });
      return best;
    },
  },
];

interface NpcEventLog {
  year: number;
  week: number;
  eventId: string;
  eventTitle: string;
  choiceText: string;
  choiceMessage: string;
  intimacyChange: number;
  intimacyAfter: number;
  memorySlotRecallText?: string;
}

interface NpcTrajectoryPoint {
  year: number; week: number; intimacy: number;
}

interface NpcReport {
  id: string;
  name: string;
  finalIntimacy: number;
  peakIntimacy: number;
  peakWeek: string;
  troughAfterMet: number;
  troughWeek: string;
  eventTimeline: NpcEventLog[];
  memorySlots: { year: number; week: number; recallText: string }[];
  endingStory: string | null;
  stage: string; // 관계 단계 라벨
}

function intimacyStage(x: number): string {
  if (x >= 85) return '절친 (85+)';
  if (x >= 70) return '가까운 친구 (70+)';
  if (x >= 50) return '친한 사이 (50+)';
  if (x >= 30) return '친구 (30+)';
  if (x >= 15) return '아는 얼굴 (15+)';
  return '거의 모르는 사이 (<15)';
}

async function runAndCollect(p: Pattern): Promise<NpcReport[]> {
  let s = createInitialState(p.gender, p.parents);
  s.routineSlot2 = p.routine2;
  s.routineSlot3 = p.routine3;

  // NPC별 로그
  const npcLogs: Record<string, NpcEventLog[]> = {};
  const npcTrajectory: Record<string, NpcTrajectoryPoint[]> = {};
  const npcMemory: Record<string, { year: number; week: number; recallText: string }[]> = {};
  for (const n of s.npcs) {
    npcLogs[n.id] = [];
    npcTrajectory[n.id] = [{ year: s.year, week: s.week, intimacy: n.intimacy }];
    npcMemory[n.id] = [];
  }

  for (let i = 0; i < 420 && s.year <= 7; i++) {
    s = processWeek(s);

    while (s.currentEvent) {
      const event = s.currentEvent;
      const ci = p.choicePolicy(s);
      const choices = s.gender === 'female' && event.femaleChoices ? event.femaleChoices : event.choices;
      const choice = choices[Math.min(ci, choices.length - 1)];

      // intimacy 변화 전 기록
      const beforeIntimacy: Record<string, number> = {};
      for (const n of s.npcs) beforeIntimacy[n.id] = n.intimacy;

      // 스탯 적용
      for (const [k, v] of Object.entries(choice.effects)) {
        const cur = (s.stats as unknown as Record<string, number>)[k] ?? 0;
        (s.stats as unknown as Record<string, number>)[k] = Math.max(0, Math.min(100, cur + (v as number)));
      }
      if (choice.fatigueEffect) s.fatigue = Math.max(0, Math.min(100, s.fatigue + choice.fatigueEffect));
      if (choice.moneyEffect) s.money += choice.moneyEffect;

      // NPC 친밀도 적용
      const affectedNpcIds = new Set<string>();
      if (choice.npcEffects) {
        for (const ne of choice.npcEffects) {
          const npc = s.npcs.find(n => n.id === ne.npcId);
          if (npc) {
            npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + ne.intimacyChange));
            npc.met = true;
            affectedNpcIds.add(ne.npcId);
          }
        }
      }
      // speakers도 기록 대상
      if (event.speakers) for (const id of event.speakers) affectedNpcIds.add(id);

      // memorySlot 생성
      const beforeSlotCount = s.memorySlots.length;
      applyMemorySlotFromChoice(s, event, ci, choice);
      const newSlot = s.memorySlots.length > beforeSlotCount ? s.memorySlots[s.memorySlots.length - 1] : null;

      // 이벤트 로그 기록 (affected NPC별)
      for (const npcId of affectedNpcIds) {
        const delta = (s.npcs.find(n => n.id === npcId)?.intimacy ?? 0) - (beforeIntimacy[npcId] ?? 0);
        if (delta === 0 && !newSlot?.npcIds?.includes(npcId)) continue; // intimacy 변화도 없고 슬롯도 없으면 skip
        npcLogs[npcId].push({
          year: s.year, week: s.week,
          eventId: event.id, eventTitle: event.title,
          choiceText: choice.text, choiceMessage: choice.message,
          intimacyChange: delta,
          intimacyAfter: s.npcs.find(n => n.id === npcId)?.intimacy ?? 0,
          memorySlotRecallText: newSlot?.npcIds?.includes(npcId) ? newSlot.recallText : undefined,
        });
        if (newSlot?.npcIds?.includes(npcId)) {
          npcMemory[npcId].push({ year: newSlot.year, week: newSlot.week, recallText: newSlot.recallText });
        }
      }

      // addBuff
      if (choice.addBuff) {
        if (!s.activeBuffs) s.activeBuffs = [];
        s.activeBuffs = s.activeBuffs.filter(b => b.id !== choice.addBuff!.id);
        s.activeBuffs.push({ ...choice.addBuff });
      }

      s.events.push({ ...event, resolvedChoice: ci, week: s.week, year: s.year,
        resolvedFemale: s.gender === 'female' && !!event.femaleChoices });
      s.currentEvent = null;
      const fu = getFollowupForWeek(s, event.location);
      if (fu) s.currentEvent = fu;
    }

    // 주차 끝마다 궤적 기록 (모든 NPC)
    for (const n of s.npcs) {
      npcTrajectory[n.id].push({ year: s.year, week: s.week, intimacy: n.intimacy });
    }

    if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
    if (s.phase === 'ending') break;
  }

  // 엔딩 근황
  const ending = calculateEnding(s);
  const npcStories = ending.npcStories;

  const reports: NpcReport[] = [];
  for (const n of s.npcs) {
    const traj = npcTrajectory[n.id];
    const metTraj = traj.filter(p => p.intimacy > 0); // 만나지 않은 NPC는 skip 판정용
    const peakPoint = traj.reduce((a, b) => b.intimacy > a.intimacy ? b : a, traj[0]);
    const troughPoint = metTraj.length > 1
      ? metTraj.slice(1).reduce((a, b) => b.intimacy < a.intimacy ? b : a, metTraj[1])
      : traj[0];

    // 엔딩 근황 키워드 찾기
    const endingStory = npcStories.find(s => s.startsWith(n.name)) ?? null;

    reports.push({
      id: n.id, name: n.name,
      finalIntimacy: Math.round(n.intimacy),
      peakIntimacy: Math.round(peakPoint.intimacy),
      peakWeek: `Y${peakPoint.year}W${peakPoint.week}`,
      troughAfterMet: Math.round(troughPoint.intimacy),
      troughWeek: `Y${troughPoint.year}W${troughPoint.week}`,
      eventTimeline: npcLogs[n.id],
      memorySlots: npcMemory[n.id],
      endingStory,
      stage: intimacyStage(n.intimacy),
    });
  }
  return reports;
}

function printNpcReport(patternName: string, npcReport: NpcReport) {
  console.log(`  [${npcReport.name}] 최종=${npcReport.finalIntimacy} (${npcReport.stage})  피크=${npcReport.peakIntimacy}@${npcReport.peakWeek}`);

  if (npcReport.eventTimeline.length === 0) {
    console.log(`      · NPC 이벤트 없음 (한 번도 만나지 않음 또는 중립 이벤트만)`);
  } else {
    console.log(`      이벤트 타임라인 (${npcReport.eventTimeline.length}건):`);
    for (const e of npcReport.eventTimeline.slice(0, 8)) {
      const sign = e.intimacyChange > 0 ? `+${e.intimacyChange}` : `${e.intimacyChange}`;
      console.log(`        Y${e.year}W${e.week} ${e.eventTitle}: ${e.choiceText} → ${sign} (= ${Math.round(e.intimacyAfter)})`);
      console.log(`            "${e.choiceMessage.slice(0, 90)}${e.choiceMessage.length > 90 ? '...' : ''}"`);
      if (e.memorySlotRecallText) {
        console.log(`            💾 memorySlot: "${e.memorySlotRecallText}"`);
      }
    }
    if (npcReport.eventTimeline.length > 8) {
      console.log(`        ... (+${npcReport.eventTimeline.length - 8}건 더)`);
    }
  }

  if (npcReport.endingStory) {
    console.log(`      🏁 엔딩: "${npcReport.endingStory}"`);
  } else if (npcReport.finalIntimacy < 50) {
    console.log(`      🏁 엔딩: (친밀도 50 미만이라 엔딩에서 언급되지 않음)`);
  }
  console.log('');
}

async function main() {
  console.log('M5 NPC 체감 리포트\n');
  console.log('5개 플레이 패턴 × 6개 NPC — 친밀도 궤적, 키워드 이벤트, 엔딩 근황\n');

  for (const p of PATTERNS) {
    console.log('\n' + '='.repeat(80));
    console.log(`▶ 패턴: ${p.name}`);
    console.log('='.repeat(80));
    const reports = await runAndCollect(p);
    for (const r of reports) printNpcReport(p.name, r);
  }

  // ===== NPC별 교차 종합 =====
  console.log('\n' + '='.repeat(80));
  console.log('▶ NPC 교차 종합 (패턴별 최종 친밀도)');
  console.log('='.repeat(80));

  const allReports: Record<string, Record<string, number>> = {}; // npcId -> pattern -> finalIntimacy
  for (const p of PATTERNS) {
    const rs = await runAndCollect(p);
    for (const r of rs) {
      if (!allReports[r.name]) allReports[r.name] = {};
      allReports[r.name][p.name] = r.finalIntimacy;
    }
  }

  console.log('\nNPC      | ' + PATTERNS.map(p => p.name.slice(0, 10).padEnd(11)).join(''));
  console.log('---------|' + '-'.repeat(12 * PATTERNS.length));
  for (const npcName of ['지훈', '수빈', '민재', '유나', '하은', '준하']) {
    const row = PATTERNS.map(p => String(allReports[npcName]?.[p.name] ?? '—').padEnd(11));
    console.log(`${npcName.padEnd(9)}| ${row.join('')}`);
  }

  console.log('\n[친밀도 단계 가이드]');
  console.log('  절친(85+): 엔딩 근황 "지금도 가장 친한 친구다"');
  console.log('  가까운(70+): 엔딩 근황 "종종 연락한다"');
  console.log('  친한(50+): 엔딩 근황 "가끔 생각나는 사이다"');
  console.log('  친구(30+): 일부 이벤트 조건 통과, 엔딩 언급 없음');
  console.log('  아는얼굴(15~30): 첫 만남만 있고 그 뒤 이벤트 거의 없음');
  console.log('  <15: 거의 사라진 관계');
}

main().catch(e => { console.error(e); process.exit(1); });
