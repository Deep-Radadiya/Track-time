import { useState } from 'react'
import { addDays, format } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { UpdatesTable } from '@/components/activity/UpdatesTable'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export default function UpdatesPage() {
  const today = iso(new Date())
  const [day, setDay] = useState(today)
  const [search, setSearch] = useState('')

  const shift = (n: number) => {
    const next = iso(addDays(new Date(`${day}T12:00:00`), n))
    if (next <= today) setDay(next)
  }
  const isToday = day === today

  return (
    <div className="space-y-5">
      <div className="select-none">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">Updates</h1>
        <p className="text-sm text-text-secondary">
          {isToday ? 'What you wrote in response to your reminders today.' : `Updates from ${format(new Date(`${day}T12:00:00`), 'EEEE, d MMMM yyyy')}.`}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="btn-ghost p-2.5 border border-border" aria-label="Previous day">
            <ChevronLeft size={18} />
          </button>
          <div className="relative flex-1 sm:flex-none">
            <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="date"
              value={day}
              max={today}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="input-field pl-9 sm:w-48"
              aria-label="Choose a date"
            />
          </div>
          <button onClick={() => shift(1)} disabled={isToday} className="btn-ghost p-2.5 border border-border" aria-label="Next day">
            <ChevronRight size={18} />
          </button>
          {!isToday && (
            <button onClick={() => setDay(today)} className="btn-ghost text-sm font-semibold text-primary px-3">
              Today
            </button>
          )}
        </div>

        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search updates or reminders…"
            className="input-field pl-9"
          />
        </div>
      </div>

      <UpdatesTable date={isToday ? undefined : day} search={search} />
    </div>
  )
}
