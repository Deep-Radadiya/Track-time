import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, /* Mic, BarChart2, */ ClipboardList, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  // { to: '/voice', icon: Mic, label: 'Voice' },
  { to: '/updates', icon: ClipboardList, label: 'Updates' },
  // { to: '/summary', icon: BarChart2, label: 'Summary' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 px-3 pb-safe">
      <div className="mb-3 flex items-center justify-around rounded-2xl bg-bg-surface/95 backdrop-blur-md border border-border px-1.5 py-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)]">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className="flex-1">
            {({ isActive }) => (
              <div
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all duration-200',
                  isActive ? 'brand-gradient text-white shadow-glow-sm' : 'text-text-muted'
                )}
              >
                <Icon size={20} />
                <span className="text-[10px] font-semibold">{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
