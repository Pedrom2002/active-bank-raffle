type AuditEvent =
  | { event: 'admin.login.success'; ip: string }
  | { event: 'admin.login.failure'; ip: string; attemptsRemaining: number }
  | { event: 'admin.logout'; ip: string }
  | { event: 'raffle.created'; raffleId: string; label: string; durationSec: number; ip: string }
  | { event: 'raffle.closed'; raffleId: string; ip: string }
  | { event: 'raffle.winner.selected'; raffleId: string; winnerId: string; totalParticipants: number; ip: string }
  | { event: 'participant.registered'; raffleId: string; participantId: string; ip: string }
  | { event: 'participant.deleted'; participantId: string; raffleId: string; ip: string }
  | { event: 'lounge.entry'; entrantId: string; ip: string }
  | { event: 'rate_limit.exceeded'; endpoint: string; ip: string }

export function audit(data: AuditEvent): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...data }))
}
