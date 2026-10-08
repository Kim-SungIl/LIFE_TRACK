import { memo, useState } from 'react';
import { Stats, StatKey, STAT_LABELS, getGrade, STAT_FLAVOR_LABELS } from '../../../engine/types';
import { getStatDescription } from '../../../engine/statDescriptions';
import { StatIcon } from '../../icons/icons';

/**
 * 능력치 막대의 높이. **10이었다** — 아이콘을 선화로 바꾸고 나니 1.5px 획 옆에서
 * 10px 막대가 실보다 얇은 선처럼 보였다. 14는 캡슐(radius = 높이/2)로 읽히는 하한이다.
 *
 * 값을 상수로 뺀 이유: 한쪽 방향만 잠그면 반대쪽 회귀가 통과한다(#438에서 겪은 형태 —
 * 비율 상한만 있는 게이트가 과축소를 '개선'으로 읽었다). 테스트가 이 값을 양방향으로 본다.
 */
export const STAT_BAR_HEIGHT = 14;

/**
 * 같은 5행이 쓰는 아이콘 치수. 막대 높이와 **값이 같지만 뜻이 다르다** — 우연히 겹친 것이라
 * 한쪽을 바꾼다고 다른 쪽이 따라가면 안 된다. 그래서 별도 상수다.
 *
 * 왜 상수인가: 이 5행은 StatsPanel · 주간 결산 표 · 결산 칩 · 엔딩 표 **네 자리**에 같은 모양으로
 * 반복된다. 리터럴로 흩어 두면 한 자리만 커져도 아무도 못 본다(실측: 엔딩만 30으로 키워도
 * 77개 전부 초록이었다). 막대 높이를 SSOT로 뽑으면서 같은 행의 짝 치수를 리터럴로 두면
 * 절반만 봉합한 것이다.
 */
export const STAT_ICON_SIZE = 14;

type Props = { stats: Stats; year: number };

// 능력치 패널 — 접기/펼치기 + 스탯별 설명 토글. 로컬 UI state(showStats/expandedStat)는 이 패널 전용.
// 주간 결산 왕복 시 MainWeekScreen 과 함께 언마운트되어 매 주 collapsed 로 초기화됨(의도된 동작).
// memo: stats 참조가 안 바뀐 동안 부모(MainWeekScreen) 리렌더로 인한 재실행 회피.
// year: academic 설명의 유지 난도 문구가 학교급을 따라간다(getStatDescription).
export const StatsPanel = memo(function StatsPanel({ stats, year }: Props) {
  const [showStats, setShowStats] = useState(false);
  const [expandedStat, setExpandedStat] = useState<StatKey | null>(null);
  return (
    <div data-tutorial="stats" style={{ background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '8px 12px', marginBottom: 10 }}>
      <button
        type="button" className="btn-reset"
        onClick={() => setShowStats(!showStats)}
        aria-expanded={showStats}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '2px 0', width: '100%' }}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>📊 능력치</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 접혀있을 때 미니 요약 — 텍스트로 표시 */}
          {!showStats && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.keys(stats) as StatKey[]).map(key => {
                const grade = getGrade(stats[key]);
                return (
                  <span key={key} style={{ fontSize: '0.62rem', fontWeight: 600, color: grade.color }}>
                    {STAT_LABELS[key]}{grade.grade}
                  </span>
                );
              })}
            </div>
          )}
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{showStats ? '▲' : '▼'}</span>
        </div>
      </button>
      {showStats && (
        <div style={{ marginTop: 6 }}>
          {(Object.keys(stats) as StatKey[]).map(key => {
            const grade = getGrade(stats[key]);
            const isExp = expandedStat === key;
            const desc = getStatDescription(key, year);
            return (
              <div key={key}>
                <button type="button" className="btn-reset" style={{ display: 'flex', alignItems: 'center', padding: '3px 0', cursor: 'pointer', width: '100%', textAlign: 'left' }} onClick={() => setExpandedStat(isExp ? null : key)} aria-expanded={isExp}>
                  {/* 선화 아이콘 — 칸 폭(20)은 그대로 두고 그림만 바뀐다. 이모지는
                      기기 폰트가 그리던 거라 크기가 제각각이었고, 이제 currentColor를 탄다. */}
                  <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', color: 'var(--text-secondary)' }}><StatIcon stat={key} size={STAT_ICON_SIZE} /></span>
                  <span style={{ width: 28, fontSize: '0.72rem', fontWeight: 600 }}>{STAT_LABELS[key]}</span>
                  <div style={{ flex: 1, height: STAT_BAR_HEIGHT, background: 'rgba(255,255,255,0.08)', borderRadius: STAT_BAR_HEIGHT / 2, margin: '0 6px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(stats[key])}%`, background: grade.color, borderRadius: STAT_BAR_HEIGHT / 2, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ width: 16, fontSize: '0.68rem', fontWeight: 700, color: grade.color }}>{grade.grade}</span>
                  <span style={{ minWidth: 56, fontSize: '0.6rem', color: grade.color, marginLeft: 4 }}>{STAT_FLAVOR_LABELS[key][grade.grade]}</span>
                  <span style={{ width: 22, fontSize: '0.62rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{Math.round(stats[key])}</span>
                </button>
                {isExp && (
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px', margin: '2px 0 4px 20px', fontSize: '0.68rem', lineHeight: 1.5 }}>
                    <div style={{ color: 'var(--text-primary)' }}>{desc.what}</div>
                    <div style={{ color: 'var(--green)', marginTop: 2 }}>▲ {desc.high}</div>
                    <div style={{ color: 'var(--red)' }}>▼ {desc.low}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
