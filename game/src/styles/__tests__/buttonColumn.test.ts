// 타이틀 흐름 **버튼 열**의 CSS 계약.
//
// 이 규칙들은 jsdom 테스트가 원리상 못 본다(레이아웃을 계산하지 않는다). 그런데 스코프를
// 한 단계 잘못 잡으면 증상이 "버튼이 맞붙는다"라 화면을 안 열면 모른다 — 실제로 그렇게 났다.
// `.title-screen .btn`(루트 스코프)은 타이틀 화면에서만 걸렸고, 같은 흐름의 다른 단계는
// 루트가 `.screen`이라 여백·최소높이가 통째로 빠져 버튼 간격이 **0px**이었다(실측).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CSS = readFileSync(resolve(__dirname, '../game.css'), 'utf-8');

/** 셀렉터의 규칙 블록을 통째로 꺼낸다(선언 존재만 훑으면 어느 규칙에 붙었는지를 못 본다). */
function ruleBlock(selector: string): string {
  const esc = selector.replace(/[.:*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|[;}])\\s*${esc}\\s*\\{([^}]*)\\}`, 'm').exec(CSS);
  if (!m) throw new Error(`game.css에 ${selector} 규칙이 없다`);
  return m[1];
}

describe('버튼 열 스코프', () => {
  // 루트가 아니라 컨테이너에 걸려야 단계가 달라도 같은 간격이 나온다.
  it('버튼 간격은 버튼 열 컨테이너 스코프에 있다', () => {
    expect(ruleBlock('.title-screen__actions .btn')).toMatch(/margin-bottom:\s*10px/);
  });

  it('버튼 최소 높이도 같은 스코프다', () => {
    expect(ruleBlock('.title-screen__actions .btn')).toMatch(/min-height:\s*56px/);
  });

  // 루트 스코프로 되돌리면 `.screen` 단계에서 규칙이 빠진다 — 그 형태를 금지한다.
  it('루트(.title-screen) 스코프의 버튼 규칙이 남아 있지 않다', () => {
    expect(CSS).not.toMatch(/\.title-screen\s+\.btn\b/);
  });

  // 부모가 가운데 정렬을 안 해주는 단계(.screen)에서도 스스로 가운데 서야 한다.
  // 폭이 360px로 확정돼 있어 flex stretch가 안 걸리고, 없으면 600px에서 좌측으로 쏠린다.
  it('버튼 열은 스스로 가운데 선다', () => {
    expect(ruleBlock('.title-screen__actions')).toMatch(/margin-inline:\s*auto/);
  });
});
