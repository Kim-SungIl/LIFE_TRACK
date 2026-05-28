# LIFE_TRACK — game/

웹 게임 본체. 루트 [README.md](../README.md) 의 게임 소개도 함께 참고하세요.

## 개발

```bash
npm install         # 최초 1회
npm run dev         # 개발 서버 (http://localhost:5173)
npm run build       # 프로덕션 빌드 (tsc -b && vite build)
npm run preview     # 빌드 결과 미리보기
npm run lint        # ESLint
```

## 검증 스크립트

이벤트 데이터·게임 로직 회귀 검증용 verify 스크립트가 `scripts/verify/` 에 있습니다.

```bash
npm run verify:events       # 빠른 스모크 — events.ts 분리 + ID order baseline
npm run verify:content      # 전체 (18개) — 콘텐츠·밸런스·패치 회귀 일괄 검증
```

`verify:content` 는 fail-fast — 첫 실패에서 중단됩니다. 개별 스크립트는
`npx tsx scripts/verify/verify-<name>.ts` 로 직접 실행 가능합니다.

### ID order baseline 갱신 (이벤트 추가/제거 시)

`verify:events` 가 `GAME_EVENTS` + `SCHOOL_LIFE_EVENTS` 의 ID 순서를
`scripts/verify/events-id-order.baseline.json` 과 비교해 회귀를 감지합니다.

**이벤트를 새로 추가/제거하거나 의도적으로 순서를 바꾼 경우**:

```bash
rm scripts/verify/events-id-order.baseline.json
npm run verify:events       # baseline 자동 재생성
git add scripts/verify/events-id-order.baseline.json
```

커밋 메시지에 갱신 이유를 함께 적으면 향후 회귀 추적이 쉽습니다.

### 알려진 비결정성

`verify-patch-batch4.ts` 의 P15 (`migrateLoadedState rngSeed`) 어설션은
내부 `hashInitialState` 가 `Date.now()` 를 쓰는 race 로 ms 경계에 걸리면
가끔 실패합니다. 재실행하면 통과 — 별도 후속에서 수정 예정.

## 디렉토리 구조

```
src/
  components/        — 화면 컴포넌트 (GameScreen 라우터 + screens/ 산하)
    screens/         — 분리된 phase 화면 (Year/Ending/EventResult/Weekly)
      main/          — 메인 화면 컨테이너 + HUD/Stats/모달 4종
  engine/            — 게임 로직 (gameEngine, store, events/, ending,
                       stateMigration, examSystem, talkSystem, ...)
scripts/
  verify/            — 회귀 검증 (npm run verify:content 의 대상)
  tools/             — 분석·리포트 (report-m5-*, report-m6-*)
public/              — 정적 자산 (배경/캐릭터/이벤트 CG)
docs/                — 스펙·프롬프트·검수 노트
```
