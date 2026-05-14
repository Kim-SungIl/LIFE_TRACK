/**
 * Phase 2.2 친밀도 50 단계 시드 — 톤 검증용 미리보기 보고서
 *
 * NPC_MINI_EVENTS에서 tier-50 시드 6개를 추출해 사람이 읽기 좋은 형태로
 * 출력. 인게임에서 친밀도 50 도달 후 첫 클릭에서 보게 될 모달의 내용을
 * 텍스트로 시뮬레이션해서 톤 검토에 쓴다.
 *
 * 사용법:
 *   npx tsx scripts/preview-tier50-tone-report.ts                 # stdout
 *   npx tsx scripts/preview-tier50-tone-report.ts --md > out.md   # markdown 파일
 *   npx tsx scripts/preview-tier50-tone-report.ts --json          # JSON (다른 AI 발주용)
 */

import { NPC_MINI_EVENTS } from '../src/engine/talkSystem';

const TIER50_IDS = [
  'talk_jihun_50_topping',
  'talk_subin_50_sentence',
  'talk_minjae_50_wrong_answer_mark',
  'talk_yuna_50_humming',
  'talk_haeun_50_window',
  'talk_junha_50_seabreeze',
] as const;

const TIER30_BY_NPC: Record<string, string[]> = {
  jihun: ['talk_jihun_basket', 'talk_jihun_badminton'],
  subin: ['talk_subin_problem'],
  minjae: ['talk_minjae_notes'],
  yuna: ['talk_yuna_song'],
  haeun: ['talk_haeun_quiet'],
  junha: ['talk_junha_riceball'],
};

const NPC_LABEL: Record<string, string> = {
  jihun: '지훈 (활발한 소꿉친구, 농구·게임·분식)',
  subin: '수빈 (외향형, 책·시·문장, 엄마와 둘이 산다)',
  minjae: '민재 (노력형 1등, 위악적 자랑 + 약한 면)',
  yuna: '유나 (밝고 감각형, 음악·즉흥성, 1등 압박)',
  haeun: '하은 (Y2+ 선배, 침묵형, 자판기·콜라)',
  junha: '준하 (Y5+ 부산 전학생, 사투리·주먹밥·향수병)',
};

const SELECTION_REASON: Record<string, { ai: string; reason: string }> = {
  talk_jihun_50_topping: {
    ai: 'Gemini',
    reason: '다른 3 AI는 PC방 컨셉으로 겹침. 식성 기억이 30단계 운동과 차별화.',
  },
  talk_subin_50_sentence: {
    ai: 'Cursor',
    reason: '4개 모두 책/문장 결, Cursor가 가장 절제. GPT의 "이름 첫 글자"는 70 톤.',
  },
  talk_minjae_50_wrong_answer_mark: {
    ai: 'Codex',
    reason: '"남한텐 안 보여줘. 좀 유치해서"가 위악적 자랑 페르소나 균열 — 캐릭터적.',
  },
  talk_yuna_50_humming: {
    ai: 'Gemini',
    reason: '"너와 떠들다가 갑자기 생각났어"가 유나의 즉흥성/감각형 강조.',
  },
  talk_haeun_50_window: {
    ai: 'Cursor',
    reason: '30단계 자판기/콜라 결에서 발전, 침묵형 캐릭터 정수.',
  },
  talk_junha_50_seabreeze: {
    ai: 'Cursor',
    reason: 'Codex/Gemini는 주먹밥 결 반복. Cursor가 30과 명확히 다른 결.',
  },
};

const args = process.argv.slice(2);
const isJSON = args.includes('--json');
const isMD = args.includes('--md') || !isJSON;

function formatStat(stats: Record<string, number> | undefined): string {
  if (!stats) return '';
  const labels: Record<string, string> = {
    academic: '학업', social: '사회', talent: '재능', mental: '멘탈', health: '체력',
  };
  return Object.entries(stats)
    .map(([k, v]) => `${labels[k] ?? k} ${v > 0 ? '+' : ''}${v}`)
    .join(', ');
}

function formatEffects(seed: typeof NPC_MINI_EVENTS[number]): string {
  const parts: string[] = [];
  if (seed.effects.intimacy) parts.push(`친밀도 ${seed.effects.intimacy > 0 ? '+' : ''}${seed.effects.intimacy}`);
  const statStr = formatStat(seed.effects.stats);
  if (statStr) parts.push(statStr);
  if (typeof seed.effects.fatigue === 'number') {
    parts.push(`피로 ${seed.effects.fatigue > 0 ? '+' : ''}${seed.effects.fatigue}`);
  }
  if (typeof seed.effects.money === 'number') {
    parts.push(`돈 ${seed.effects.money > 0 ? '+' : ''}${seed.effects.money}만원`);
  }
  return parts.join(' / ');
}

if (isJSON) {
  const out = TIER50_IDS.map(id => {
    const seed = NPC_MINI_EVENTS.find(e => e.id === id);
    if (!seed) return null;
    return {
      id,
      npc: NPC_LABEL[seed.npcId!],
      tier30_seeds: TIER30_BY_NPC[seed.npcId!] ?? [],
      description: seed.description,
      effects: formatEffects(seed),
      message: seed.message,
      selection: SELECTION_REASON[id],
    };
  }).filter(Boolean);
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log('# Phase 2.2 친밀도 50 단계 시드 — 톤 검증 미리보기\n');
  console.log('> 인게임에서 친밀도 50 도달 후 첫 "말 걸기" 클릭에서 보게 될 모달 내용.');
  console.log('> 6개 시드 모두 선택지 없음 (description + 효과 적용 + message 한 줄로 끝).\n');
  console.log('---\n');

  for (const id of TIER50_IDS) {
    const seed = NPC_MINI_EVENTS.find(e => e.id === id);
    if (!seed) {
      console.log(`## ⚠️ ${id} — 시드 누락\n`);
      continue;
    }
    const sel = SELECTION_REASON[id];
    const tier30Ids = TIER30_BY_NPC[seed.npcId!] ?? [];

    console.log(`## ${seed.npcId} — \`${id}\``);
    console.log(`**NPC**: ${NPC_LABEL[seed.npcId!]}`);
    console.log(`**채택**: ${sel.ai} — ${sel.reason}`);
    console.log(`**30단계 기존 시드 (중복 회피 비교)**: ${tier30Ids.join(', ')}\n`);

    console.log('### 📝 인게임 모달 description');
    console.log('```');
    console.log(seed.description);
    console.log('```\n');

    console.log('### ⚡ 효과');
    console.log(`- 변동: ${formatEffects(seed)}`);
    console.log(`- 메시지: \`${seed.message}\`\n`);

    console.log('### 🔎 톤 체크포인트');
    console.log('- [ ] "두 사람만의 일상 코드"인가? (30단계 가벼운 호의 / 70단계 속마음 사이)');
    console.log(`- [ ] ${seed.npcId} 캐릭터 결과 일치하는가? (다른 NPC로 바꿔도 통하면 빈약)`);
    console.log(`- [ ] 30단계 시드(${tier30Ids.join('/')})와 컨셉 중복 없는가?`);
    console.log('- [ ] 학년 종속 표현 없는가?');
    console.log('- [ ] 종결형 묘사("~하고 가버렸다") 없는가?\n');
    console.log('---\n');
  }

  console.log('## 종합 검토 의견 적는 곳\n');
  console.log('| NPC | 톤 OK | 어색하면 교체 추천 (GPT/Codex/Gemini/Cursor 중) | 한 줄 사유 |');
  console.log('|---|---|---|---|');
  for (const id of TIER50_IDS) {
    const seed = NPC_MINI_EVENTS.find(e => e.id === id);
    if (!seed) continue;
    console.log(`| ${seed.npcId} | ☐ | (해당시) | |`);
  }
  console.log('\n검토 후 어색한 시드 지목해주시면, PR #128 단계에서 비교한 다른 AI 결과로 즉시 교체 PR 생성 가능합니다.');
}
