import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isTomorrow, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const date = parseISO(dateStr)
    const timeStr = format(date, 'h:mm a')
    if (isToday(date)) return `Today ${timeStr}`
    if (isTomorrow(date)) return `Tomorrow ${timeStr}`
    return format(date, 'MMM d, yyyy · h:mm a')
  } catch {
    return dateStr
  }
}

export function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true })
  } catch {
    return dateStr
  }
}

export function formatTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'h:mm a')
  } catch {
    return dateStr
  }
}

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

export function parseApiError(error: unknown): string {
  if (!error) return 'An unexpected error occurred'
  const err = error as { response?: { data?: { detail?: unknown } }; message?: string }
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d?.msg ?? '').join(', ')
  }
  return err?.message ?? 'An unexpected error occurred'
}

import type { Reminder } from '@/types/api'

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function formatTimeOfDay(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

export function formatSchedule(reminder: Reminder): string {
  switch (reminder.repeat_type) {
    case 'once':
      return reminder.date && reminder.time
        ? `Once on ${format(parseISO(reminder.date), 'MMM d, yyyy')} at ${formatTimeOfDay(reminder.time)}`
        : 'Once'
    case 'hourly':
      return reminder.active_start && reminder.active_end
        ? `Every hour, ${formatTimeOfDay(reminder.active_start)} – ${formatTimeOfDay(reminder.active_end)}`
        : 'Every hour'
    case 'daily':
      return reminder.time ? `Every day at ${formatTimeOfDay(reminder.time)}` : 'Every day'
    case 'weekly':
      return reminder.time && reminder.day_of_week !== null
        ? `Every ${WEEKDAY_NAMES[reminder.day_of_week]} at ${formatTimeOfDay(reminder.time)}`
        : 'Every week'
    case 'monthly':
      return reminder.time && reminder.day_of_month !== null
        ? `Every month on the ${ordinal(reminder.day_of_month)} at ${formatTimeOfDay(reminder.time)}`
        : 'Every month'
    default:
      return ''
  }
}

export function formatLunch(reminder: Reminder): string | null {
  if (!reminder.lunch_start || !reminder.lunch_end) return null
  return `Skipped ${formatTimeOfDay(reminder.lunch_start)} – ${formatTimeOfDay(reminder.lunch_end)}`
}

export const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo',
  'Asia/Singapore', 'Australia/Sydney', 'Pacific/Auckland',
]
