// verify-dist-boot.ts — 배포 산출물이 **브라우저에서 실제로 뜨는가**. (build job 전용)
//
// 이 리포의 잠금은 전부 소스나 산출물을 **텍스트로 읽는다**. dist 게이트 다섯도 그렇다 —
// 폰트 경로 문자열, 청크 파일 목록, CSS 선언, 축소본 파일 존재. 그래서 "파일이 다 있고
// 문자열도 맞는데 화면은 빈 채"인 상태를 아무도 못 본다. 실제로 CI에 브라우저 층이
// **0건**이었다: 871개 유닛 테스트도 jsdom이라 번들·경로·실행 순서를 안 지나간다.
//
// 이 게이트가 잡는 것(다른 층이 원리상 못 보는 것만):
//
//   · 부팅 시 던져지는 예외 — 번들에는 다 들어 있는데 실행 순서가 틀려 첫 프레임이 빈 화면
//   · `base`가 어긋난 경로 — 파일은 dist에 있는데 브라우저가 다른 URL로 찾는다
//   · 런타임이 요청하는데 산출물엔 없는 자산(.webp 404 계열). 정적 검사는 "png가 있나"를
//     보지만 런타임은 .webp만 요청한다 — 두 목록이 갈리면 화면만 깨진다
//   · 콘솔 에러. jsdom에선 안 나고 실제 엔진에서만 나는 것들이 있다
//
// 실행: cd game && npx tsx scripts/verify/verify-dist-boot.ts   (dist가 있어야 한다)
//
// **`verify-dist-` 접두가 규약이다.** `run-chain.ts`가 그 이름을 보고 체인에서 빼고
// (별도 러너라 dist가 없다), `verify-ci-gates.ts`가 같은 집합에서 build job의 요구 스텝을
// 파생한다 — 그래서 이 파일을 만들고 deploy.yml에 안 붙이는 반대 방향도 같이 잡힌다.
import { chromium, type Browser } from 'playwright';
import { createServer, type Server } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, join, extname, normalize } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
/**
 * 볼 산출물. 인자로 다른 디렉터리를 줄 수 있다 — 스펙이 **합성 dist**에 대고 이 스크립트를
 * 실제로 돌려 rc를 확인한다. 스크립트는 자기 종료 경로를 스스로 못 잠근다(실측: 판정부
 * 호출을 통째로 지워도 ✅ rc=0이었다. DOM 하한을 0으로 낮춰도 마찬가지다 — 실제 dist는
 * 멀쩡하니 음성 대조군이 없다).
 */
const DIST = resolve(ROOT, process.argv[2] ?? 'dist');
/** `vite.config.ts`의 production base. 여기가 어긋나면 실서버에서 전부 404다. */
const BASE = '/LIFE_TRACK/';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** 서버가 실제로 내준 것. 404는 **서버 쪽에서** 센다 — 브라우저 이벤트만 보면 캐시·중복에 휘둘린다. */
interface Served { readonly url: string; readonly status: number }

function startServer(): Promise<{ server: Server; port: number; served: Served[] }> {
  const served: Served[] = [];
  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    const record = (status: number) => served.push({ url, status });

    if (!url.startsWith(BASE)) {
      record(404);
      res.writeHead(404).end('base 밖');
      return;
    }
    // `..`를 막는다. dist 밖을 읽어 주면 이 게이트가 거짓 초록을 낸다.
    const rel = normalize(decodeURIComponent(url.slice(BASE.length)));
    if (rel.startsWith('..')) {
      record(403);
      res.writeHead(403).end('경로 이탈');
      return;
    }
    // `normalize('')`는 `.`을 낸다 — 디렉터리로 떨어지면 index.html로 접는다.
    let file = join(DIST, rel);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      record(404);
      res.writeHead(404).end('없음');
      return;
    }
    record(200);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      .end(readFileSync(file));
  });
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      ok({ server, port: typeof addr === 'object' && addr ? addr.port : 0, served });
    });
  });
}

interface Probe {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
}

const problems: string[] = [];
const fail = (msg: string) => problems.push(msg);

/**
 * 관측 결과를 문제 목록으로 바꾸는 **판정부**. 자기검사가 이걸 **그대로 다시 돌린다**.
 *
 * 관측기만 확인하면 판정부가 죽은 것을 못 본다 — 실측: `s.status >= 400`을 `>= 900`으로
 * 바꿔도 초록이었다(탐침 404를 *기록은* 했으니 자기검사는 통과했다). 수집기든 임계든
 * 호출부든, 탐침을 심은 뒤 같은 판정이 그걸 **말하지 않으면** 어딘가 죽은 것이다.
 */
function judgeSignals(probe: Probe, served: readonly Served[]): string[] {
  const out: string[] = [];
  if (probe.pageErrors.length) out.push(`부팅 중 예외 ${probe.pageErrors.length}건:\n    ${probe.pageErrors.join('\n    ')}`);
  if (probe.consoleErrors.length) out.push(`콘솔 에러 ${probe.consoleErrors.length}건:\n    ${probe.consoleErrors.join('\n    ')}`);
  if (probe.requestFailures.length) out.push(`요청 실패 ${probe.requestFailures.length}건:\n    ${probe.requestFailures.join('\n    ')}`);

  const bad = served.filter((s) => s.status >= 400);
  if (bad.length) {
    out.push(`산출물에 없는 것을 런타임이 요청한다 ${bad.length}건 (base 어긋남·webp 누락 계열):\n    ` +
      bad.slice(0, 15).map((b) => `${b.status} ${b.url}`).join('\n    '));
  }
  return out;
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.log('❌ dist/index.html이 없다 — 이 게이트는 배포 산출물을 본다. `npm run build:release` 먼저.');
    process.exit(1);
  }

  const { server, port, served } = await startServer();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();

    const probe: Probe = { consoleErrors: [], pageErrors: [], requestFailures: [] };
    page.on('console', (m) => { if (m.type() === 'error') probe.consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => probe.pageErrors.push(e.message));
    page.on('requestfailed', (r) => probe.requestFailures.push(`${r.url()} — ${r.failure()?.errorText}`));

    const url = `http://127.0.0.1:${port}${BASE}`;
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    if (res?.status() !== 200) fail(`첫 응답이 ${res?.status()}다 — index.html을 못 받았다`);

    // ── 화면이 실제로 그려졌는가 ────────────────────────────────────────────
    // 빈 `<div id="root">`도 DOM은 있다. 자식 수와 **보이는 글자 길이**를 같이 본다.
    const shape = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        title: document.title,
        children: root?.childElementCount ?? 0,
        text: (root?.innerText ?? '').trim().length,
        buttons: document.querySelectorAll('button').length,
      };
    });
    if (shape.title !== '7년의 시간표') fail(`<title>이 '${shape.title}'이다 — index.html이 안 실렸거나 덮였다`);
    if (shape.children < 1) fail('#root가 비어 있다 — 번들은 받았는데 첫 프레임이 안 그려졌다');
    if (shape.text < 20) fail(`#root의 보이는 글자가 ${shape.text}자다 — 화면이 사실상 비었다`);
    if (shape.buttons < 1) fail('버튼이 하나도 없다 — 조작 가능한 화면이 아니다');

    // ── 조용한 실패들 ──────────────────────────────────────────────────────
    for (const p of judgeSignals(probe, served)) fail(p);

    // ── 하네스가 살아 있는가 (양성 대조군) ──────────────────────────────────
    // **이 블록이 없으면 위 판정은 전부 부정형이라 공허해질 수 있다.** 관측기가 죽은 것과
    // "문제가 없다"가 구별되지 않는다 — 리포의 다른 게이트들이 똑같이 당했다.
    // 하한은 1이다. "몇 건 이상"으로 살아 있음을 재려 하면 합성 dist를 거부한다(실측 —
    // 5로 뒀더니 index.html 한 건짜리 정상 픽스처가 빨강이었다). 관측기가 살아 있다는
    // 근거는 개수가 아니라 아래 탐침이 댄다.
    if (served.length < 1) fail('서버가 아무것도 안 내줬다 — 페이지를 받은 적이 없다');

    await page.evaluate(() => { console.error('__boot-probe__'); });
    await page.evaluate((b) => fetch(`${b}__boot-probe-missing__.json`).catch(() => {}), BASE);
    await page.waitForTimeout(300);

    // **판정부를 통째로 다시 돌린다.** 관측기만 보면 임계·호출부가 죽은 것을 못 본다.
    const afterProbe = judgeSignals(probe, served).join('\n');
    if (!afterProbe.includes('__boot-probe__')) {
      fail('자기검사: 일부러 낸 콘솔 에러를 판정이 안 담았다 — 위 "콘솔 에러 0건"은 근거가 없다');
    }
    if (!afterProbe.includes('__boot-probe-missing__')) {
      fail('자기검사: 일부러 낸 404를 판정이 안 담았다 — 위 "404 0건"은 근거가 없다');
    }
  } finally {
    await browser?.close();
    server.close();
  }

  if (problems.length) {
    console.log(`❌ 배포 산출물이 브라우저에서 제대로 안 뜬다 — ${problems.length}건\n`);
    for (const p of problems) console.log(`  · ${p}`);
    console.log('\n  이 층이 없으면 파일·문자열은 다 맞는데 화면만 빈 상태가 CI를 통과한다.');
    process.exit(1);
  }
  console.log(`✅ 배포 부팅 — 첫 화면이 그려지고 콘솔 에러·404 0건 (요청 ${served.length}건 / 자기검사 2종 통과)`);
  process.exit(0);
}

await main();
