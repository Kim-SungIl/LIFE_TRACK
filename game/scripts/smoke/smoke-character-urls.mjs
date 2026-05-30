// Smoke test — feat/high-school-fullbody-promotion
// EventScene.tsx의 prefix 분기 로직을 노드에서 재현하여
// 모든 (NPC × year × gender) 조합의 예상 URL이 dev 서버에서 200을 반환하는지 검증.
// 200이 아니면 fallback chain이 동작하는지 확인 필요.
//
// 실행: cd game && node scripts/smoke-character-urls.mjs

const BASE = 'http://localhost:5173';
// 이벤트에 실제 등장하는 NPC와 그 학년(year) 범위. 도달 가능한 (npc × year)만
// 검증해 false positive(미등장 학년의 자산 누락)를 제거.
//   - haeun: Y2 전학 → 이후. (elementary 없음 = 정상)
//   - doyun: Y1 만남 ~ Y2 school-split 까지. (high 도달 안 함)
//   - junha: Y6 전학 (고등 전용). (_middle/_elementary 없음 = 정상)
// seoa/siwoo/yerin 은 미등장(오펀)이라 제외.
const NPC_YEARS = {
  jihun: [1, 2, 3, 4, 5, 6, 7],
  subin: [1, 2, 3, 4, 5, 6, 7],
  minjae: [1, 2, 3, 4, 5, 6, 7],
  yuna: [1, 2, 3, 4, 5, 6, 7],
  haeun: [2, 3, 4, 5, 6, 7],
  doyun: [1, 2],
  junha: [6, 7],
};
const NPCS = Object.keys(NPC_YEARS);
const PLAYERS = ['player_m', 'player_f'];
const YEARS = [1, 2, 3, 4, 5, 6, 7];

// 네이밍 SSOT(characterAssets.ts)와 동일: Y1 elementary / Y2~4 middle / Y5+ high
function prefix(npc, year) {
  if (year === 1) return `${npc}_elementary`;
  if (year >= 5) return `${npc}_high`;
  return `${npc}_middle`;
}

async function check(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const ct = res.headers.get('content-type') ?? '';
    // Vite dev 서버는 없는 자산에도 SPA fallback으로 200(text/html)을 반환.
    // image/* content-type 인지 확인해야 진짜 PNG.
    if (res.status === 200 && ct.startsWith('image/')) return 200;
    if (res.status === 200) return 'spa-fallback';
    return res.status;
  } catch (e) {
    return 0;
  }
}

const seen = new Set();
const expectedUrls = [];

// NPC fullbody — 등장 학년(NPC_YEARS)만 검증. 도달 가능한 자산이므로 모두 critical.
for (const npc of NPCS) {
  for (const year of NPC_YEARS[npc]) {
    const url = `${BASE}/images/characters/${prefix(npc, year)}_fullbody.png`;
    if (!seen.has(url)) {
      expectedUrls.push({ url, npc, year, kind: 'staged-fullbody', critical: true });
      seen.add(url);
    }
  }
}

// Player — 전 학년 등장 (Y1 elem / Y2~4 middle / Y5+ high)
for (const p of PLAYERS) {
  for (const year of YEARS) {
    const url = `${BASE}/images/characters/${prefix(p, year)}_fullbody.png`;
    if (!seen.has(url)) {
      expectedUrls.push({ url, npc: p, year, kind: 'player-fullbody', critical: true });
      seen.add(url);
    }
  }
}

console.log(`총 ${expectedUrls.length}개 URL 검증 중...\n`);

const results = await Promise.all(expectedUrls.map(async (e) => ({ ...e, status: await check(e.url) })));

const ok = results.filter(r => r.status === 200);
const missing = results.filter(r => r.status !== 200);

console.log(`✓ 200 OK: ${ok.length}/${results.length}`);
console.log(`✗ Missing (non-200): ${missing.length}\n`);

if (missing.length > 0) {
  console.log('===== Missing URLs (자산 없음 / spa-fallback) =====');
  console.log('critical | year | npc/player | url | status');
  console.log('---------|------|------------|-----|-------');
  for (const m of missing) {
    const flag = m.critical ? '⚠️  CRITICAL' : '   non-crit';
    console.log(`${flag} | Y${m.year} | ${m.npc} (${m.kind}) | ${m.url.replace(BASE, '')} | ${m.status}`);
  }
  console.log('\n참고: Y2~Y4 NPC들은 base fullbody가 없어도 onError 폴백으로 base neutral → CSS로 떨어짐.');
  console.log('CRITICAL은 Y1(elementary) 또는 Y5+(high) 자산 — 이건 반드시 있어야 함.');
}

// fallback chain 도달 가능성 검증: 누락된 staged 자산이 있어도 base fullbody가 존재하는지
const fallbackCheck = [];
for (const m of missing.filter(x => x.kind === 'staged-fullbody')) {
  const baseUrl = `${BASE}/images/characters/${m.npc}_middle_fullbody.png`;
  const status = await check(baseUrl);
  fallbackCheck.push({ ...m, baseUrl, baseStatus: status });
}
if (fallbackCheck.length > 0) {
  console.log('\n===== Fallback 체크 — staged 누락 시 base로 떨어질 수 있는지 =====');
  for (const f of fallbackCheck) {
    const ok = f.baseStatus === 200 ? '✓ base OK' : '✗ base도 없음 → CSS로 떨어짐';
    console.log(`  Y${f.year} ${f.npc} → base=${f.baseStatus} ${ok}`);
  }
}

const criticalMissing = missing.filter(m => m.critical);
if (criticalMissing.length > 0) {
  console.log(`\n❌ CRITICAL ${criticalMissing.length}개 누락 — fix 필요`);
  process.exit(1);
} else {
  console.log('\n✅ 등장 NPC × 학년 자산 모두 OK.');
}
