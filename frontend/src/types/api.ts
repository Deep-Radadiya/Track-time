export type RepeatType = 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly'

export interface LoginRequest {
  email: string
  password: string
}

export interface SignupRequest {
  email: string
  password: string
  timezone?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface User {
  id: string
  email: string
  timezone: string
  reminders_enabled: boolean
}

export interface UserUpdate {
  reminders_enabled?: boolean | null
  timezone?: string | null
}

export interface Reminder {
  id: string
  user_id: string
  title: string
  repeat_type: RepeatType
  time: string | null
  date: string | null
  day_of_week: number | null
  day_of_month: number | null
  active_start: string | null
  active_end: string | null
  lunch_start: string | null
  lunch_end: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ReminderCreateRequest {
  title: string
  repeat_type: RepeatType
  time?: string | null
  date?: string | null
  day_of_week?: number | null
  day_of_month?: number | null
  active_start?: string | null
  active_end?: string | null
  lunch_start?: string | null
  lunch_end?: string | null
}

export interface ReminderUpdateRequest extends ReminderCreateRequest {
  is_active?: boolean
}

export interface Device {
  id: string
  is_primary: boolean
  last_active_at: string
  push_enabled: boolean
}
