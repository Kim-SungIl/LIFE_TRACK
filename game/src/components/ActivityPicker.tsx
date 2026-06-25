import { useState } from 'react';
import { Activity, StatKey, STAT_LABELS, GameState } from '../engine/types';
import { getActivityCost, isVacationLimitReached } from '../engine/activities';
import { activityHints } from '../engine/activityHints';

const CAT_INFO: Record<string, { emoji: string; name: string; desc: string }> = {
  study:    { emoji: '📚', name: '공부',     desc: '학업 성적을 올린다' },
  exercise: { emoji: '💪', name: '운동',     desc: '체력과 멘탈을 키운다' },
  social:   { emoji: '👥', name: '관계',     desc: '친구를 만나고 인기를 올린다' },
  talent:   { emoji: '🎨', name: '자기계발', desc: '특기와 실력을 키운다' },
  rest:     { emoji: '😴', name: '휴식',     desc: '피로를 풀고 쉰다' },
  parent:   { emoji: '💝', name: '가족',     desc: '가족과 함께하는 시간' },
  work:     { emoji: '💼', name: '알바',     desc: '돈을 벌며 경험을 쌓는다' },
};

// 수치 → 서술형 변환
function describeEffect(stat: StatKey, value: number): string {
  const name = STAT_LABELS[stat];
  const abs = Math.abs(value);
  if (value > 0) {
    if (abs >= 4) return `${name} 크게 상승`;
    if (abs >= 2) return `${name}에 좋음`;
    return `${name} 소폭 상승`;
  } else {
    if (abs >= 3) return `${name} 크게 하락`;
    if (abs >= 2) return `${name} 하락`;
    return `${name} 소폭 하락`;
  }
}

function describeFatigue(fatigue: number): string {
  if (fatigue >= 10) return '매우 피곤함';
  if (fatigue >= 7) return '꽤 피곤함';
  if (fatigue >= 4) return '피로 있음';
  if (fatigue > 0) return '약간 피곤함';
  if (fatigue <= -12) return '완전 회복';
  if (fatigue <= -5) return '많이 쉴 수 있음';
  return '피로 회복';
}

interface Props {
  activities: Activity[];
  selected: string[];
  onToggle: (id: string) => void;
  maxSlots: number;
  currentSlots: number;
  state: GameState;
  npcChoices?: Record<string, string>;
  compact?: boolean;
  availableMoney?: number;
  // 이 슬롯에서 NPC 동행 선택이 가능한지(주말/방학 true, 루틴 false). '💛 관계 유지' 태그 정합용.
  companionEligible?: boolean;
}

export function ActivityPicker({ activities, selected, onToggle, maxSlots, currentSlots, state, npcChoices = {}, compact = false, availableMoney, companionEligible = true }: Props) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const money = availableMoney !== undefined ? availableMoney : state.money;
  const categories = ['study', 'exercise', 'social', 'talent', 'rest', 'parent', 'work'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {categories.map(cat => {
        const catActivities = activities.filter(a => a.category === cat);
        if (catActivities.length === 0) return null;

        const info = CAT_INFO[cat];
        const isExpanded = expandedCat === cat;
        const selectedInCat = catActivities.filter(a => selected.includes(a.id));

        return (
          <div key={cat} style={{
            background: 'rgba(42,34,48,0.9)',
            borderRadius: 12,
            overflow: 'hidden',
            border: selectedInCat.length > 0 ? '1px solid rgba(224,138,91,0.3)' : '1px solid rgba(255,255,255,0.1)',
          }}>
            {/* 카테고리 헤더 */}
            <div
              onClick={() => setExpandedCat(isExpanded ? null : cat)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', cursor: 'pointer',
                background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.2rem' }}>{info.emoji}</span>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{info.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{info.desc}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedInCat.length > 0 && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--blue)', fontWeight: 600 }}>
                    ✓ {selectedInCat.map(a => a.name).join(', ')}
                  </span>
                )}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {/* 펼쳐진 활동 목록 */}
            {isExpanded && (
              <div style={{ padding: '0 10px 10px' }}>
                {/* 수치 보기 토글 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                  <span
                    onClick={(e) => { e.stopPropagation(); setShowDetail(!showDetail); }}
                    style={{
                      fontSize: '0.65rem', color: showDetail ? 'var(--blue)' : 'var(--text-muted)',
                      cursor: 'pointer', padding: '1px 6px', borderRadius: 4,
                      background: showDetail ? 'rgba(125,163,217,0.15)' : 'transparent',
                    }}
                  >
                    {showDetail ? '수치 ON' : '수치 보기'}
                  </span>
                </div>

                {catActivities.map(a => {
                  const isSel = selected.includes(a.id);
                  const cost = getActivityCost(a, state.year);
                  const canAfford = (cost <= 0 || money >= cost) && (!a.requires || a.requires(state));
                  const canSelect = isSel || currentSlots + a.slots <= maxSlots || a.slots >= maxSlots;
                  // Phase 1: vacationLimit 도달 시 새 선택 불가 (이미 선택돼 있으면 그대로 유지)
                  const vacLimitReached = !isSel && isVacationLimitReached(a, state);
                  const disabled = !canSelect || !canAfford || vacLimitReached;
                  // Phase 1: 방학 한정 활동 표시 + 남은 횟수
                  const isVacationOnly = a.seasonGate === 'vacation-only';
                  const vacUsed = state.vacationActivityCounts?.[a.id] ?? 0;
                  const showVacLimit = state.isVacation && a.vacationLimit !== undefined;

                  // 전략 신호 태그 (장기/맥락 — 단기 효과에 안 드러나는 결과). 수치 토글과 무관하게 항상.
                  const stratHints = activityHints(a, state, companionEligible);

                  // 서술형 태그 생성
                  const hintTags: { text: string; color: string }[] = [];
                  if (!showDetail) {
                    for (const [k, v] of Object.entries(a.effects)) {
                      const val = v as number;
                      hintTags.push({
                        text: describeEffect(k as StatKey, val),
                        color: val > 0 ? 'var(--green)' : 'var(--red)',
                      });
                    }
                    hintTags.push({
                      text: describeFatigue(a.fatigue),
                      color: a.fatigue > 0 ? 'var(--red)' : 'var(--green)',
                    });
                  }

                  return (
                    <div key={a.id}
                      onClick={() => !disabled && onToggle(a.id)}
                      style={{
                        padding: compact ? '8px 10px' : '10px 12px',
                        marginTop: 4, borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
                        background: isSel ? 'rgba(224,138,91,0.25)' : 'rgba(255,255,255,0.06)',
                        border: isSel ? '1px solid var(--accent)' : '1px solid transparent',
                        opacity: disabled && !isSel ? 0.4 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {/* 상단: 이름 + 비용 + 체크 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{a.name}</span>
                          {isVacationOnly && (
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 600,
                              color: 'var(--accent)',
                              background: 'rgba(224,138,91,0.15)',
                              padding: '1px 6px', borderRadius: 4,
                            }}>
                              🏖 방학
                            </span>
                          )}
                          {cost > 0 && (
                            <span style={{ fontSize: '0.72rem', color: canAfford ? 'var(--yellow)' : 'var(--red)' }}>
                              ({cost}만{compact ? '/주' : ''})
                            </span>
                          )}
                          {cost < 0 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--green)' }}>
                              (+{-cost}만)
                            </span>
                          )}
                          {npcChoices[a.id] && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-soft)' }}>
                              ({state.npcs.find(n => n.id === npcChoices[a.id])?.name})
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {a.slots > 1 && <span style={{ fontSize: '0.65rem', color: 'var(--purple)' }}>{a.slots}칸 사용</span>}
                          {showVacLimit && (
                            <span style={{
                              fontSize: '0.65rem',
                              color: vacLimitReached ? 'var(--red)' : 'var(--text-muted)',
                              fontWeight: vacLimitReached ? 600 : 400,
                            }}>
                              {vacLimitReached ? '이번 방학 사용 완료' : `방학당 ${a.vacationLimit}회 (${vacUsed}/${a.vacationLimit})`}
                            </span>
                          )}
                          {cost > 0 && money < cost && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--red)', fontWeight: 600 }}>💰부족</span>
                          )}
                          {isSel && <span style={{ fontSize: '0.9rem' }}>✓</span>}
                        </div>
                      </div>

                      {/* flavor 텍스트 — 방학 시 vacationDescription 우선 */}
                      {!compact && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
                          {state.isVacation && a.vacationDescription ? a.vacationDescription : a.flavor}
                        </div>
                      )}

                      {/* 서술형 힌트 태그 (기본 모드) */}
                      {!showDetail && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: compact ? 4 : 6 }}>
                          {hintTags.map((tag, i) => (
                            <span key={i} style={{
                              fontSize: '0.68rem', color: tag.color,
                              background: tag.color.includes('green') ? 'rgba(143,181,115,0.1)' : 'rgba(217,100,88,0.1)',
                              padding: '2px 7px', borderRadius: 4,
                            }}>
                              {tag.text}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 상세 수치 (토글 ON) */}
                      {showDetail && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: compact ? 4 : 6 }}>
                          {Object.entries(a.effects).map(([k, v]) => (
                            <span key={k} style={{
                              fontSize: '0.7rem', color: (v as number) > 0 ? 'var(--green)' : 'var(--red)',
                              background: (v as number) > 0 ? 'rgba(143,181,115,0.1)' : 'rgba(217,100,88,0.1)',
                              padding: '1px 6px', borderRadius: 4,
                            }}>
                              {STAT_LABELS[k as StatKey]}{(v as number) > 0 ? '+' + v : v}
                            </span>
                          ))}
                          <span style={{
                            fontSize: '0.7rem',
                            color: a.fatigue > 0 ? 'var(--red)' : 'var(--green)',
                            background: a.fatigue > 0 ? 'rgba(217,100,88,0.1)' : 'rgba(143,181,115,0.1)',
                            padding: '1px 6px', borderRadius: 4,
                          }}>
                            피로{a.fatigue > 0 ? '+' : ''}{a.fatigue}
                          </span>
                        </div>
                      )}

                      {/* 전략 신호 태그 (앰버/초록 — 장기·맥락 결과. 효과 태그와 시각적 구분) */}
                      {stratHints.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                          {stratHints.map((h, i) => (
                            <span key={i} style={{
                              fontSize: '0.68rem', fontWeight: 600,
                              color: h.tone === 'good' ? 'var(--green)' : 'var(--accent)',
                              background: h.tone === 'good' ? 'rgba(143,181,115,0.12)' : 'rgba(224,138,91,0.15)',
                              border: `1px solid ${h.tone === 'good' ? 'rgba(143,181,115,0.3)' : 'rgba(224,138,91,0.35)'}`,
                              padding: '2px 7px', borderRadius: 4,
                            }}>
                              {h.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
