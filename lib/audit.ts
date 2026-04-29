/**
 * Structured audit logger. Writes JSON lines to stdout (captured by Vercel log drain).
 * Deliberately omits PII — log IDs, not names/phones.
 */

type AuditEvent =
  | { event: 'admin.login.success'; ip: string }
  | { event: 'admin.login.failure'; ip: string; attemptsRemaining: number }
  | { event: 'admin.logout'; ip: string }
  | { event: 'session.created'; sessionId: string; sessionName: string; ip: string }
  | { event: 'session.closed'; sessionId: string; method: 'manual' | 'replaced'; ip: string }
  | {
      event: 'draw.created'
      sessionId: string
      drawId: string
      label: string
      winnerId: string
      totalParticipants: number
      ip: string
    }
  | {
      event: 'raffle.winner.selected'
      sessionId: string
      winnerId: string
      totalParticipants: number
      ip: string
    }
  | { event: 'participant.registered'; sessionId: string; participantId: string; ip: string }
  | { event: 'participant.deleted'; participantId: string; sessionId: string; ip: string }
  | { event: 'rate_limit.exceeded'; endpoint: string; ip: string }

export function audit(data: AuditEvent): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...data }))
}
