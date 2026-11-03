// 친구 초대 카드(monthInvites) — 월 계획 화면과 주간 화면(계획을 안 짠 달의 이번 주 초대)이 같이 쓴다.
import { josa } from '../../../engine/korean';
import { inviteLine, inviteVoice } from '../../../engine/talkData/inviteVoices';
import type { MonthInvite } from '../../../engine/types';
import { getWeekInfo, getWeekOfMonth } from '../../../engine/weekMath';

/**
 * 친구 초대 카드 — 좋아(그 칸을 약속으로 고정) / 다음에(친밀도 −1).
 * 월 계획 화면에선 저장 전까지 답을 바꿀 수 있고, 주간 화면·주간에서 이미 답한 초대는 바로 확정이라 `locked`로 그린다.
 */
export function InviteCard({ invite, answer, npcName, cost, onAnswer, locked = false, acceptBlocked }: {
  invite: MonthInvite; answer: boolean | undefined; npcName: string; cost: number; onAnswer: (accepted: boolean) => void;
  /** 답이 확정됐다 — 버튼을 잠그고 답한 쪽만 눌린 채로 둔다. */
  locked?: boolean;
  /** [좋아]만 잠그는 이유(주간 화면 — 수락하면 돈 때문에 확정이 잠긴다). 있으면 카드에 그 줄을 보인다. */
  acceptBlocked?: string;
}) {
  const vac = getWeekInfo(invite.week).isVacation;
  const when = `${getWeekOfMonth(invite.week)}주차 ${vac ? '하루' : invite.slotIdx === 0 ? '토요일' : '일요일'}`;
  // 친구마다 말투가 다르다(talkData/inviteVoices.ts) — 누가 불러도 같은 말이면 초대가 달마다 다른 요청이 못 된다.
  const line = inviteLine(invite.npcId, invite.activityId, invite.week, when);
  const decline = inviteVoice(invite.npcId).decline;
  return (
    <section aria-label={`${npcName}의 초대`} data-testid={`invite-${invite.npcId}`} style={{
      background: 'var(--bg-card-hover)', border: '1px solid rgba(240,164,122,0.35)', borderRadius: 14,
      padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--accent-soft)', fontWeight: 600 }}>{npcName}의 초대 · {when}</span>
        <span style={{ fontSize: '0.9rem' }}>{line}</span>
      </div>
      {answer === false && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{decline.startsWith('"') ? `${npcName}: ${decline}` : decline}</div>}
      {acceptBlocked && answer === undefined && <div data-testid="invite-accept-blocked" style={{ fontSize: '0.75rem', color: 'var(--red)', fontWeight: 600 }}>{acceptBlocked}</div>}
      {answer === true && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>약속했다. 그 칸은 {josa(npcName, '와/과')} 보내는 시간으로 비워 둔다.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
        {/* btn-reset은 여백 0·왼쪽 정렬이라 테두리에 글자가 붙는다 — 계획 띠 버튼(#541)과 같이 여백·가운데 정렬을 준다. */}
        <button type="button" className="btn-reset" aria-pressed={answer === true} disabled={locked || !!acceptBlocked} onClick={() => onAnswer(true)} style={{
          minHeight: 44, opacity: acceptBlocked && !locked ? 0.45 : 1, padding: '6px 10px', textAlign: 'center', borderRadius: 10, background: answer === true ? 'var(--accent)' : 'transparent',
          color: answer === true ? 'var(--btn-ink)' : 'var(--text-primary)', border: '1px solid var(--accent)', fontWeight: 700,
        }}>좋아{cost > 0 ? ` · ${cost}만` : ''}</button>
        <button type="button" className="btn-reset" aria-pressed={answer === false} disabled={locked} onClick={() => onAnswer(false)} style={{
          minHeight: 44, padding: '6px 10px', textAlign: 'center', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
          background: answer === false ? 'var(--bg-secondary)' : 'transparent', color: 'var(--text-primary)',
        }}>다음에</button>
      </div>
    </section>
  );
}
