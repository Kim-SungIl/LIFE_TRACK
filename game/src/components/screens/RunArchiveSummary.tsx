import { isArchiveSaveFailed, loadArchive, type RunDelta } from '../../engine/archive';
import { barelyTouchedNames } from '../../engine/npcStoryPool';
import { chipSurface } from './surface';

interface Props {
  // 이번 판의 적립 결과. store의 값은 메모리라 엔딩 화면에서 새로고침하면 null이 되므로
  // (전이 시점에만 계산된다) archive에 영속된 lastRunDelta로 떨어진다 — 예전에는 이때
  // "처음 본 이야기" 줄이 조용히 사라졌다.
  runDelta: RunDelta | null;
}

/**
 * 엔딩 화면 하단 — 이번 판이 기록에 무엇을 더했는지, 그리고 다음 판의 이정표.
 *
 * 왜 사람 이름을 가리키나 (실측):
 *   같은 방식으로 한 판 더 하면 새로 보이는 이야기가 1~5개뿐인데, 키우는 방식(루틴·활동)을
 *   바꾸면 +72개가 열리고 그 92%가 NPC와 얽힌 이벤트다. 선택지만 다르게 눌러서는 소용이
 *   없다는 것도 확인했다 — 선택 정책 3종의 합집합이 첫 판 대비 +5개뿐이었다.
 *   그래서 "다른 길은 어땠을까?"라는 막연한 문구 대신, 남은 것을 사람 이름으로 가리킨다.
 *
 * 왜 "안 만난 사람"이 아니라 "거의 못 본 사람"인가:
 *   못 본 건 관계가 아니라 그 사람의 이야기다 — 도달형 이벤트는 학년으로 게이트돼 그 학년이
 *   지나면 다시 안 열린다. 친밀도만 올려서는 회수되지 않는다.
 *
 * 단, 이름을 대는 건 **만난 적 있는 사람에게만**이다. 완주하면 전원을 만난다는 건 사실이
 *   아니다 — 348판 중 5판(1.4%)이 서아·예린·시우를 못 만난 채 엔딩에 닿고, 그 판에서
 *   미접촉자는 ratio 0으로 정렬 첫 줄을 차지한다. npcPeak을 넘겨 기록실과 같은 게이트를 쓴다.
 *
 * ⚠️ **이 화면의 근거는 두 개다** — `runDelta`(메모리)와 `archive`(디스크). 둘이 갈릴 수 있고,
 *   갈리는 순간 이 화면이 거짓말을 한다: 기록 쓰기만 실패한 환경에서는 delta가 "완주 N회"라고
 *   말하는데 디스크의 runs는 그대로다(실측: 반환 1 / 디스크 0 / 예외 없음 / 세이브는 성공).
 *   그래서 메모리 우선 자체는 유지하되(플레이어가 본 것은 사실이다) **기록이 남지 않았다는
 *   사실을 같이 말한다.** 요약을 없애는 처방은 쓰지 않는다 — 저장 사고의 벌을 성취 쪽에
 *   물리는 셈이라, "숨기지 않는다"는 이 화면의 목적과 정면으로 어긋난다.
 */
export function RunArchiveSummary({ runDelta }: Props) {
  const archive = loadArchive();
  const barely = barelyTouchedNames(archive.events, archive.npcPeak);
  const delta = runDelta ?? archive.lastRunDelta;
  const newEvents = delta?.newEvents ?? 0;
  const runs = delta?.runs ?? archive.runs;
  // 기록 쓰기가 실패하고 있나. **본 게임 세이브 실패(saveFailed prop)와 다른 축**이라
  // 여기서 직접 읽는다 — 이 컴포넌트는 이미 loadArchive()로 기록층을 직접 보고 있고,
  // 중간에 prop을 하나 더 끼우면 그 배선을 빠뜨려도 tsc가 통과한다(#431).
  const recordFailed = isArchiveSaveFailed();

  // 첫 완주에 "처음 본 이야기 121개"는 의미가 없다(전부 처음이다) — 2회차부터 보여준다.
  const showNew = runs > 1 && newEvents > 0;

  // 경고만 있는 경우에도 카드를 띄운다. 예전 구조는 여기서 한 줄짜리 문구로 빠져나갔는데,
  // 그러면 "첫 완주 + 스친 사람 없음 + 기록 실패"에서 경고가 통째로 사라진다.
  if (!showNew && barely.length === 0 && !recordFailed) {
    return (
      <div style={{ fontSize: '0.8rem', color: 'var(--accent-soft)', marginBottom: 16, textAlign: 'center', fontStyle: 'italic' }}>
        다른 길은 어땠을까?
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '14px 16px', margin: '0 auto 16px', maxWidth: 360,
    }}>
      {/* 기록이 디스크에 안 닿았다는 사실. 성취를 가리지 않으려고 **맨 위에, 그러나 따로** 둔다 —
          아래 줄들은 여전히 참이고(플레이어가 본 것), 이 줄만이 기록층에 대한 말이다.
          색·바닥은 주간 화면의 저장 실패 배너와 같은 값이다(chipSurface로 바닥을 선언해야
          대비 게이트가 판정할 수 있다 — 틴트만으로는 사진 위에서 2.77:1까지 떨어진다). */}
      {recordFailed && (
        <div role="alert" aria-live="assertive" style={{
          background: chipSurface('rgba(217,100,88,0.15)'), border: '1px solid rgba(217,100,88,0.4)',
          borderRadius: 10, padding: '8px 12px', marginBottom: showNew || barely.length ? 12 : 0,
          fontSize: '0.75rem', fontWeight: 600, textAlign: 'center', color: 'var(--red)', lineHeight: 1.6,
        }}>
          ⚠️ 이 학창시절은 기록실에 남지 않았어요
          <div style={{ fontWeight: 400, marginTop: 2 }}>브라우저 저장 공간을 확인해 주세요</div>
        </div>
      )}

      {showNew && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: barely.length ? 12 : 0 }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>이번 판에서 처음 본 이야기</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gold)' }}>{newEvents}</span>
        </div>
      )}

      {barely.length > 0 && (
        <>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            스치기만 하고 지나간 사람
          </div>
          <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, wordBreak: 'keep-all' }}>
            {barely.join(' · ')}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--accent-soft)', marginTop: 10, fontStyle: 'italic', lineHeight: 1.6 }}>
            그때 곁에 있었어야만 열리는 이야기가 있다.
          </div>
        </>
      )}
    </div>
  );
}
