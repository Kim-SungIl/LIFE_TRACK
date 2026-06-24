// talkData 배럴 — 데이터/로직 분리(P3-9) 이후 데이터가 비대해져(2056줄)
// 카테고리별로 분할(2026-06-24). 외부는 기존처럼 'engine/talkData'에서 import (경로 무변경).
//   miniEvents     — 미니이벤트 타입 + NPC/부모 미니이벤트 + 부모 절정(climax)
//   npcSmalltalk   — 잡담 풀 타입 + NPC 잡담
//   parentSmalltalk— 부모 잡담
export * from './miniEvents';
export * from './npcSmalltalk';
export * from './parentSmalltalk';
