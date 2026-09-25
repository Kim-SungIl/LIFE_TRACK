// events/light-result.ts
// 결과 화면(EventResultScreen, "계속 →")을 **생략하는** 가벼운 사건의 id 집합 — T46.
//
// 왜: 반장 잡무 3종은 7년 완주에 각 ~21회·합 63회 뜬다(24시드 실측, president.ts 주석).
// 한 건의 경로가 이벤트 화면 → 결과 화면("계속 →") → 주간 결산이라, 잡무 1건 = 화면 2·탭 2에
// **같은 결과 문장이 세 번**(결과 화면 · 결산 hero · 결산 내레이션 목록) 보였다. 밀도·쿨다운·
// 횟수 캡은 두 번 실측으로 기각된 축이라(캡=치환이 아니라 삭제), 남은 축은 화면 수다.
//
// 편입 기준 — 넷 다 만족해야 한다. `lightResultEvents.test.ts`가 카탈로그에서 파생해 잠근다.
//  1. 결과 문장이 결산 hero에 도달한다 — store.resolveEvent가 `📖 {message}`를 weekLog.messages에
//     push하고 WeeklyResultScreen이 📖 **마지막** 줄을 hero로 올린다. 결과 화면과 무관한 경로라
//     화면을 건너뛰어도 문장은 결산에서 읽히고, 생략은 "뒤에 사건이 안 걸렸을 때"만이라
//     생략된 문장은 언제나 그 주의 마지막 📖 = hero다.
//  2. 효과가 소폭이다 — 스탯 |Δ| ≤ LIGHT_RESULT_EFFECT_CAP.stat, 피로 ≤ .fatigue,
//     친밀도·버프·돈·시간·진로·부모·기억 슬롯 없음. 배지는 결산 스탯 행이 대신 보여준다.
//  3. CG가 없다 — 결과 화면이 CG를 보여주는 유일한 자리다. 매니페스트 전 경로에 0장이어야 한다.
//  4. followup을 끌지 않고 자신도 followup이 아니다 — 어떤 후속 이벤트의 condition도 이 id를
//     읽지 않는다. (끈다면 결과 화면이 "다음 장면으로 넘어가는 문"이라 건너뛰면 어색하다.)
//
// **체인 판정은 여기가 아니라 GameScreen.onChoice가 한다** — 집합에 있어도 해결 직후 다음
// 이벤트가 걸렸으면(phase가 'result'로 안 떨어짐) 결과 화면을 유지한다. 여기는 "자격"만 둔다.
//
// 늘리거나 줄일 때: 아래 배열만 고친다. 기준 4개는 테스트가 카탈로그에서 다시 재므로,
// 자격 없는 id를 넣으면 그 자리에서 빨강이 된다.

/** 편입 기준 2의 상한 — "소폭"의 정의. 테스트가 이 값에서 파생한다(리터럴 금지). */
export const LIGHT_RESULT_EFFECT_CAP = { stat: 4, fatigue: 3 } as const;

export const LIGHT_RESULT_EVENT_IDS: ReadonlySet<string> = new Set<string>([
  // 반장 잡무 3종 (president.ts PRESIDENT_ONLY) — 각 ~21회/판
  'president-errand',
  'president-mediate',
  'president-speech',
]);
