import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { readTheme, subscribeTheme, toggleTheme } from '@/lib/theme'

export default function ThemeToggle({ className }) {
  const [theme, setTheme] = useState(() => readTheme())

  useEffect(() => subscribeTheme(setTheme), [])

  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={label}
      title={label}
      onClick={() => setTheme(toggleTheme())}
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  )
}