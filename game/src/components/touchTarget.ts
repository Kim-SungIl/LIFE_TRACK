// 크롬 컨트롤의 포인터 타깃 바닥 — WCAG 2.5.8 **AA = 24×24 CSS px**.
// (44×44는 2.5.5 AAA라 이 리포의 목표가 아니다. 주 게임 루프는 이미 통과한다:
//  활동 슬롯 246×60 · 선택지 272×42 · 친구 280×44 · CTA 280×47.)
//
// 320px 실측에서 걸린 건 전부 **크롬·보조 컨트롤**이었다:
//   💬 가정 / 🚪 메뉴 34.3×17 · 📖 기록장 43.5×17 · 부모 칩 22×22
//   🔊 소리 / 🎵 배경음 24×20.8 · 시험 타임라인 마커 14×14 ~ 27.2×10
// `🚪 메뉴`는 데스크톱에서 게임을 나가는 **유일한 보이는 입구**인데 세로 17px이었다.
//
// ## 왜 "투명 히트 영역"인가
// 이 리포의 원칙은 "UI 절제는 크롬에만"이다. 보이는 크기를 키우면 헤더가 시끄러워진다.
// 그래서 **보이는 것(글자·아이콘·배경)은 그대로 두고 박스만** 24×24로 넓히고,
// 넓힌 만큼을 음수 마진으로 되돌려 **레이아웃 자리는 한 픽셀도 움직이지 않게** 한다.
// #456이 320px에서 겨우 없앤 HUD 겹침(컨트롤이 상태 블록 위에 그려지던 것)이
// 히트 영역을 키우다 되살아나면 접근성을 고치고 레이아웃을 깨는 셈이 된다.

import type { CSSProperties } from 'react';

/** WCAG 2.5.8 (AA) 포인터 타깃 최소 변 길이. */
export const TOUCH_TARGET_MIN = 24;

/**
 * HUD 컨트롤 행이 원래 차지하던 줄 높이 = 부모 강점 칩의 지름.
 * 히트 영역은 이 자리 **안에서만** 커진다 — 행 높이가 22를 넘으면 HUD가 통째로 내려간다.
 */
export const CHROME_ROW_BOX = 22;

/** 24로 넓힌 박스를 원래 바깥 상자(`formerBox`)로 되돌리는 한 변당 음수 마진. */
export function hitAreaBleed(formerBox: number): number {
  return -(TOUCH_TARGET_MIN - formerBox) / 2;
}

/**
 * 크롬 컨트롤용 투명 히트 영역.
 *
 * @param axis
 *  - `'y'`  세로만 되돌린다. 가로가 이미 24 이상인 라벨 버튼(💬 가정 34.3 · 📖 기록장 43.5)과
 *           아이콘 버튼(🔊 24.0)은 좌우 마진을 건드리면 기존 `marginLeft` 간격이 깨진다.
 *  - `'both'` 가로·세로 둘 다. 22×22 부모 칩처럼 두 축이 모두 모자란 경우.
 * @param formerBox 넓히기 **전** 바깥 상자(px). 이만큼으로 자리를 되돌린다.
 *
 * 반환값은 항상 `minWidth`/`minHeight`를 **둘 다** 실어 보낸다 — 한 축만 선언하면
 * 반대 축이 폰트·라벨 변경으로 24 아래로 내려가도 조용히 통과한다.
 */
export function hitArea(axis: 'y' | 'both' = 'y', formerBox = CHROME_ROW_BOX): CSSProperties {
  const bleed = hitAreaBleed(formerBox);
  return {
    minWidth: TOUCH_TARGET_MIN,
    minHeight: TOUCH_TARGET_MIN,
    // 늘어난 박스 안에서 보이는 것을 가운데에 둔다 — 넓히기 전과 같은 자리에 찍힌다.
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: bleed,
    marginBottom: bleed,
    ...(axis === 'both' ? { marginLeft: bleed, marginRight: bleed } : {}),
  };
}
