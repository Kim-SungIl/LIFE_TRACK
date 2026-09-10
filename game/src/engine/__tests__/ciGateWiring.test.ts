// **CI가 게이트를 실제로 부르는가.**
//
// 이 파일이 따로 있는 이유는 하나다. 같은 판정을 `verify:ci`에서도 돌리는데(content-verify job),
// **그 `verify:ci` 스텝 자체를 deploy.yml에서 지우면 그쪽 검사는 아예 실행되지 않는다.**
// 이 테스트는 build job의 `npm test`에서 도므로 그 편집을 여기서 잡는다.
// 반대로 `npm test` 스텝을 지우면 content-verify 쪽이 잡는다 — 두 자리가 서로를 덮는다.
// 한 자리에만 두면 그 자리를 지우는 단일 편집이 통과한다(#397·#431과 같은 "호출부 미잠금" 계열).
//
// import 자체에도 의미가 있다: verify-ci-gates.ts는 **모듈 최상위에서 자기검사를 돌리므로**,
// 파서나 판정부가 깨지면 이 파일이 import 단계에서 터진다.
import { describe, expect, it } from 'vitest';
import { auditRepo, auditGates, parseWorkflow } from '../../../scripts/verify/verify-ci-gates';

describe('CI 게이트 배선', () => {
  it('deploy.yml이 package.json의 dist 게이트를 전부 부른다', () => {
    const { problems, distGates } = auditRepo();
    // 전제 붕괴 방지 — 요구가 0이면 "전부 충족"으로 공허하게 통과한다.
    expect(distGates.length, '전제 붕괴: verify:dist-* 스크립트를 하나도 못 찾았다').toBeGreaterThanOrEqual(5);
    expect(problems.map(p => `[${p.kind}] ${p.detail}`)).toEqual([]);
  });

  it('전제: 실제 워크플로가 파싱된다 (job 3개 · build 스텝 다수)', () => {
    const { jobs } = auditRepo();
    expect(jobs.map(j => j.name)).toEqual(['build', 'content-verify', 'deploy']);
    expect(jobs[0].runs.length).toBeGreaterThan(5);
  });

  // 양성 대조군 — 판정부가 살아 있는지 매 실행마다 확인한다. 위 두 단언은 "문제 없음"만 보므로
  // 판정부를 통째로 비워도 통과한다(부정형 단언만 두면 분기를 지워도 초록인 계열).
  it('게이트 스텝을 지운 합성 워크플로는 잡힌다', () => {
    const yaml = [
      'jobs:',
      '  build:',
      '    steps:',
      '      - run: npm run lint',
      '      - run: npm test',
      '      - run: npm run build:release',
      '  content-verify:',
      '    steps:',
      '      - run: npm run verify:ci',
      '  deploy:',
      '    needs: [build, content-verify]',
      '    steps:',
      '      - uses: actions/deploy-pages@v4',
    ].join('\n');
    const kinds = auditGates(parseWorkflow(yaml), ['verify:dist-fonts']).map(p => p.kind);
    expect(kinds).toEqual(['게이트 미배선']);
  });
});
