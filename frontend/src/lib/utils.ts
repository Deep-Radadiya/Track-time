import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import type { Task } from '@/types/api'

// Joins Tailwind class names and drops the ones that clash, e.g. cn('p-2', isBig && 'p-4').
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// "Today 3:30 PM", "Tomorrow 9:00 AM", or a full date for anything later.
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

// ON = the server still sends this reminder. OFF (done or blocked) = paused.
export function isReminderOn(task: Task): boolean {
  return ['pending', 'in_progress', 'snoozed'].includes(task.status)
}

// Turns any API error into one readable sentence for a toast.
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

/**
 * Reads when a login token (JWT) expires, without checking its signature.
 * Returns seconds since 1970, or 0 when the token cannot be read.
 */
export function getTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp : 0
  } catch {
    return 0
  }
}
