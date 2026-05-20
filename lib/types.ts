export type Raffle = {
  id: string
  label: string
  status: 'active' | 'closed'
  duration_sec: number
  starts_at: string
  ends_at: string | null
  winner_id: string | null
  created_at: string
}

export type RaffleParticipant = {
  id: string
  raffle_id: string
  name: string
  phone?: string
  email?: string
  registered_at: string
}

export type RaffleQR = {
  raffle_id: string
  label: string
  expires_at: number
  ends_at: number
  qr_data_url: string
}

export type Winner = {
  raffle_id: string
  label: string
  name: string
  phone: string
}

export type LoungeEntrant = {
  id: string
  name: string
  phone: string
  email: string
  entered_at: string
}

export type Toast = { id: number; kind: 'success' | 'info' | 'error'; text: string }

export type ParticipantRecord = {
  id: string
  raffle_id: string
  raffle_label: string
  name: string
  phone: string
  email: string
  registered_at: string
}

export type WinnerRecord = {
  raffle_id: string
  raffle_label: string
  ends_at: string | null
  created_at: string
  winner: { id: string; name: string; phone: string; email: string }
}

export type PagedResponse<T> = {
  rows: T[]
  total: number
  page: number
  page_size: number
}
