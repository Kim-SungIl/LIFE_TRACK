// Smoke test — feat/high-school-fullbody-promotion
// EventScene.tsx의 prefix 분기 로직을 노드에서 재현하여
// 모든 (NPC × year × gender) 조합의 예상 URL이 dev 서버에서 200을 반환하는지 검증.
// 200이 아니면 fallback chain이 동작하는지 확인 필요.
//
// 실행: cd game && node scripts/smoke-character-urls.mjs

const BASE = 'http://localhost:5173';
// 실제 게임 NPC (gameEngine.ts L71-81). 자산이 있는 doyun/seoa/siwoo/yerin은
// 게임에 등장하는 NPC가 아니므로 검증 대상 제외.
const NPCS = ['jihun', 'subin', 'minjae', 'yuna', 'haeun', 'junha'];
const PLAYERS = ['player_m', 'player_f'];
const GENDERS = ['male', 'female'];
const YEARS = [1, 2, 3, 4, 5, 6, 7];

function prefix(npc, year) {
  if (year === 1) return `${npc}_elementary`;
  if (year >= 5) return `${npc}_high`;
  return npc;
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

// NPC fullbody (gender-neutral path — base는 항상 시도, gendered _f는 여자 주인공일 때만 first try)
for (const npc of NPCS) {
  for (const year of YEARS) {
    const p = prefix(npc, year);
    const url = `${BASE}/images/characters/${p}_fullbody.png`;
    if (!seen.has(url)) {
      expectedUrls.push({ url, npc, year, kind: 'staged-fullbody', critical: year === 1 || year >= 5 });
      seen.add(url);
    }
  }
}

// Player (Y1=elem, Y5+=high, else base)
for (const p of PLAYERS) {
  for (const year of YEARS) {
    const stage = year === 1 ? '_elementary' : year >= 5 ? '_high' : '';
    const url = `${BASE}/images/characters/${p}${stage}_fullbody.png`;
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
  const baseUrl = `${BASE}/images/characters/${m.npc}_fullbody.png`;
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
  console.log('\n✅ CRITICAL 자산 모두 OK. Y2~Y4 누락은 fallback으로 처리됨.');
}
