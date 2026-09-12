// run-chain.ts — 콘텐츠 검증 체인을 **실행기로** 돌린다 (`npm run verify:ci`의 본체)
//
// 왜 문자열 체인을 버렸나: 이전엔 package.json에 `tsx a.ts && tsx b.ts && ...` 34개가
// 한 줄로 들어 있었다. 그 줄은 **자유 형식 셸**이라, 게이트가 그걸 정규식으로 해석하는 한
// 미탐과 오탐이 원리적으로 함께 난다(3차 검수 실측):
//   · `&&` 하나를 개행으로 바꾸면 — npm은 `sh -c`라 `-e`조차 없어 앞 게이트가 죽어도 rc=0
//   · `;` · `#` · 선행 `echo` — 전부 같은 계열의 변형이고 토큰을 하나씩 막는 건 끝이 없다
//   · 반대로 인용된 `;`나 주석의 `#`은 정당한데 오탐이 났다
// 실행기로 옮기면 그 층이 **사라진다**: 체인은 더 이상 문자열이 아니고, rc는 여기서 직접 본다.
//
// 목록도 하드코딩하지 않는다 — 디스크의 `verify-*.ts`에서 **파생**한다. 새 검증 스크립트를
// 만들면 저절로 체인에 들어오므로 "만들고 안 붙이는" 방향이 원천적으로 막힌다.
//
// 실행: cd game && npx tsx scripts/verify/run-chain.ts

import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { resolve, join } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
export const VERIFY_DIR = resolve(ROOT, 'scripts/verify');

export function verifyFilesOnDisk(dir: string = VERIFY_DIR): string[] {
  return readdirSync(dir).filter(f => /^verify-.*\.ts$/.test(f)).map(f => f.replace(/\.ts$/, '')).sort();
}

/**
 * **build job에서만 돌 수 있는** 검증. content-verify는 별도 러너라 dist도 vitest 리포트도 없다 —
 * 여기서 돌리면 반드시 실패한다. 이름으로 파생하되(`verify-dist-*`), 파생이 안 되는 것만 적는다.
 * 이 집합이 build job의 실제 배선과 어긋나면 `verify-ci-gates`가 잡는다 — 양쪽이 서로를 잠근다.
 */
export function buildJobOnly(files: readonly string[] = verifyFilesOnDisk()): string[] {
  return files.filter(f => f.startsWith('verify-dist-') || f === 'verify-test-floor').sort();
}

export function chainFiles(files: readonly string[] = verifyFilesOnDisk()): string[] {
  const only = new Set(buildJobOnly(files));
  return files.filter(f => !only.has(f));
}

if (process.argv[1] && import.meta.url === (await import('url')).pathToFileURL(process.argv[1]).href) {
  const files = chainFiles();
  if (files.length === 0) {
    console.log('❌ 체인이 비었다 — scripts/verify에서 verify-*.ts를 하나도 못 찾았다');
    process.exit(1);
  }
  console.log(`콘텐츠 검증 체인 ${files.length}종 (scripts/verify에서 파생)\n`);
  const failed: string[] = [];
  for (const f of files) {
    const r = spawnSync('npx', ['tsx', join(VERIFY_DIR, `${f}.ts`)], { stdio: 'inherit', cwd: ROOT });
    if (r.status !== 0) {
      failed.push(f);
      console.log(`\n❌ ${f} 실패 (rc=${r.status ?? 'signal'})\n`);
      break;   // 체인은 첫 실패에서 멈춘다 — 이전 `&&` 체인과 같은 의미다
    }
  }
  if (failed.length > 0) {
    console.log(`\n❌ 체인 실패 — ${failed.join(', ')}`);
    process.exit(1);
  }
  console.log(`\n✅ 체인 ${files.length}종 전부 통과`);
  process.exit(0);
}
