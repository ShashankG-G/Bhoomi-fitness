const REASON_LABELS = {
  ok: 'Entry allowed',
  expired: 'Expired code',
  no_membership: 'No active membership',
  invalid: 'Invalid code',
  not_found: 'Member not found',
}

function reasonLabel(reason) {
  if (!reason) return null
  return REASON_LABELS[reason] || reason.replace(/_/g, ' ')
}

/**
 * Full-screen allow/deny flash. `result` is
 * { allow: boolean, member: { name, has_active_membership } | null, reason: string }
 * or null when nothing to show.
 */
export default function ResultFlash({ result }) {
  if (!result) return null

  const { allow, member, reason } = result

  return (
    <div
      className={'result-flash ' + (allow ? 'result-allow' : 'result-deny')}
      role="alert"
      aria-live="assertive"
    >
      <div className="result-icon" aria-hidden="true">
        {allow ? <CheckIcon /> : <CrossIcon />}
      </div>
      <div className="result-status">{allow ? 'ALLOW' : 'DENY'}</div>
      {member?.name && <div className="result-name">{member.name}</div>}
      {!allow && reason && <div className="result-reason">{reasonLabel(reason)}</div>}
    </div>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 100 100" width="120" height="120" fill="none">
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="6" />
      <path d="M28 52l15 15 29-33" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 100 100" width="120" height="120" fill="none">
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="6" />
      <path d="M34 34l32 32M66 34L34 66" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </svg>
  )
}
