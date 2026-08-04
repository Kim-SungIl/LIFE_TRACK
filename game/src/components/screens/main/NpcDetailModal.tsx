import { GameState, NpcState } from '../../../engine/types';
import { Portrait } from '../../Portrait';
import { Dialog } from '../../Dialog';
import { breakSentences } from '../shared';
import { npcAbsence, relationshipSignal } from '../../../engine/relationshipSignals';
import { bestNpcRecall } from '../../../engine/memorySystem';

const SIGNAL_COLOR = { warn: '#d9a05b', good: '#8fb573', info: '#8a8078' } as const;

type Props = {
  npc: NpcState;
  state: GameState;
  // 친밀도/상황 기반 기본 인사말 — 부모(MainWeekScreen)가 getNpcDialogue 로 사전 계산해 전달
  dialogue: string;
  // 말 걸기 후 잡담 라인 — null 이면 dialogue 표시, 있으면 잡담 라인으로 교체
  smalltalk: string | null;
  onTalk: () => void;
  onClose: () => void;
};

export function NpcDetailModal({ npc, state, dialogue, smalltalk, onTalk, onClose }: Props) {
  // 부재(전출·졸업) 중이면 잔상 모드 — 패널 카드(#331)와 톤을 맞춘다.
  // 이전엔 패널만 잔상 처리돼서, "떠난 자리" 카드를 누르면 컬러 초상·살아있는 게이지·말 걸기가
  // 그대로 있는 모달이 열렸다(같은 화면이 한 친구를 두 상태로 말하던 모순).
  const absent = npcAbsence(npc, state);
  const recall = absent ? bestNpcRecall(state, npc.id) : null;
  const intimacyColor = npc.intimacy >= 70 ? 'var(--accent-soft)' : npc.intimacy >= 40 ? 'var(--yellow)' : 'var(--text-muted)';
  const intimacyLabel = npc.intimacy >= 70 ? '절친' : npc.intimacy >= 40 ? '친구' : '아는 사이';
  const signal = relationshipSignal(npc, state);
  return (
    <Dialog onClose={onClose} labelledBy="npc-detail-name" maxWidth={340}
      contentStyle={{
        background: 'linear-gradient(135deg, rgba(42,34,48,0.98), rgba(23,21,28,0.98))',
        borderRadius: 16, padding: 24, textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* 잔상: 흑백 + 부재 시점 학교급으로 고정 — 떠난 뒤 자란 얼굴을 현재 학년으로 그리지 않는다. */}
        <div style={{ filter: absent ? 'grayscale(1)' : 'none', display: 'flex', justifyContent: 'center' }}>
          <Portrait characterId={npc.id} size={72} expression="neutral" year={absent?.stageYear ?? state.year} />
        </div>
        <div id="npc-detail-name" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 12 }}>{npc.name}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, fontStyle: absent ? 'italic' : undefined }}>
          {absent ? absent.note : (npc.intimacy >= 30 ? npc.description : '같은 학교 친구')}
        </div>

        {absent ? (
          // 회상 한 줄 — 이미 얻은 기억의 읽기 전용 반사. 기억이 없으면 이 자리를 비운다
          // (억지 생성 금지 — 회상 레이어의 "0장 허용" 원칙과 동일).
          recall && (
            <div style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px',
              marginTop: 14, fontStyle: 'italic', fontSize: '0.8rem', lineHeight: 1.6,
              color: 'var(--text-secondary)', wordBreak: 'keep-all', overflowWrap: 'break-word',
            }}>
              {recall}
            </div>
          )
        ) : (
          <>
            {/* 인사말 — 친밀도/상황에 따라 다양한 대사. 말 걸기 클릭 시 잡담 라인으로 교체됨. */}
            <div style={{
              background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px',
              marginTop: 14, fontStyle: 'italic', fontSize: '0.85rem', lineHeight: 1.6,
              whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word',
            }}>
              {smalltalk
                ? smalltalk
                : `"${breakSentences(dialogue)}"`}
            </div>

            {/* 친밀도 — 부재 중엔 숨긴다(패널이 게이지를 지우고 note만 남기는 것과 동일 판단). */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: intimacyColor }}>{intimacyLabel}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>친밀도 {Math.round(npc.intimacy)}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${npc.intimacy}%`, background: intimacyColor, borderRadius: 3 }} />
              </div>
              {/* 관계 신호 — 방치/최근/임박 */}
              {signal && (
                <div style={{ fontSize: '0.7rem', color: SIGNAL_COLOR[signal.tone], marginTop: 8 }}>
                  {signal.text}
                </div>
              )}
            </div>
          </>
        )}

        {/* 말 걸기는 재적 중일 때만 — 사전 결정 모델. 클릭 시 상단 인사말 영역이 잡담 라인으로 교체.
            부재 친구는 버튼을 disabled로 두지 않고 아예 안 그린다(회색 버튼은 "언젠가 가능"을 암시). */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {!absent && <button className="btn btn-primary" style={{ flex: 1 }} onClick={onTalk}>말 걸기</button>}
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>닫기</button>
        </div>
    </Dialog>
  );
}
