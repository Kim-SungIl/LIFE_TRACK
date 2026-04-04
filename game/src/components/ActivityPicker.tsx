import { useState } from 'react';
import { Activity, StatKey, STAT_LABELS, GameState } from '../engine/types';

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
}

export function ActivityPicker({ activities, selected, onToggle, maxSlots, currentSlots, state, npcChoices = {}, compact = false, availableMoney }: Props) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

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
            background: 'rgba(15,52,96,0.9)',
            borderRadius: 12,
            overflow: 'hidden',
            border: selectedInCat.length > 0 ? '1px solid rgba(233,69,96,0.3)' : '1px solid rgba(255,255,255,0.1)',
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
                  <span style={{ fontSize: '0.72rem', color: 'var(--blue, #5b8def)', fontWeight: 600 }}>
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
                      background: showDetail ? 'rgba(91,141,239,0.15)' : 'transparent',
                    }}
                  >
                    {showDetail ? '수치 ON' : '수치 보기'}
                  </span>
                </div>

                {catActivities.map(a => {
                  const isSel = selected.includes(a.id);
                  const money = availableMoney !== undefined ? availableMoney : state.money;
                  const canAfford = (a.moneyCost <= 0 || money >= a.moneyCost) && (!a.requires || a.requires(state));
                  const canSelect = isSel || currentSlots + a.slots <= maxSlots;
                  const disabled = !canSelect || !canAfford;

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
                        background: isSel ? 'rgba(233,69,96,0.25)' : 'rgba(255,255,255,0.06)',
                        border: isSel ? '1px solid var(--accent)' : '1px solid transparent',
                        opacity: disabled && !isSel ? 0.4 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {/* 상단: 이름 + 비용 + 체크 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{a.name}</span>
                          {a.moneyCost > 0 && (
                            <span style={{ fontSize: '0.72rem', color: canAfford ? 'var(--yellow)' : 'var(--red)' }}>
                              ({a.moneyCost}만{compact ? '/주' : ''})
                            </span>
                          )}
                          {a.moneyCost < 0 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--green)' }}>
                              (+{-a.moneyCost}만)
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
                          {a.moneyCost > 0 && money < a.moneyCost && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--red)', fontWeight: 600 }}>💰부족</span>
                          )}
                          {isSel && <span style={{ fontSize: '0.9rem' }}>✓</span>}
                        </div>
                      </div>

                      {/* flavor 텍스트 */}
                      {!compact && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
                          {a.flavor}
                        </div>
                      )}

                      {/* 서술형 힌트 태그 (기본 모드) */}
                      {!showDetail && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: compact ? 4 : 6 }}>
                          {hintTags.map((tag, i) => (
                            <span key={i} style={{
                              fontSize: '0.68rem', color: tag.color,
                              background: tag.color.includes('green') ? 'rgba(76,175,80,0.1)' : 'rgba(255,87,34,0.1)',
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
                              background: (v as number) > 0 ? 'rgba(76,175,80,0.1)' : 'rgba(255,87,34,0.1)',
                              padding: '1px 6px', borderRadius: 4,
                            }}>
                              {STAT_LABELS[k as StatKey]}{(v as number) > 0 ? '+' + v : v}
                            </span>
                          ))}
                          <span style={{
                            fontSize: '0.7rem',
                            color: a.fatigue > 0 ? 'var(--red)' : 'var(--green)',
                            background: a.fatigue > 0 ? 'rgba(255,87,34,0.1)' : 'rgba(76,175,80,0.1)',
                            padding: '1px 6px', borderRadius: 4,
                          }}>
                            피로{a.fatigue > 0 ? '+' : ''}{a.fatigue}
                          </span>
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
