import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { loadApiKey, saveApiKey } from '@/lib/ai'

const FIELDS = [
  {
    id: 'gemini',
    label: 'Gemini API key',
    placeholder: 'AIza…',
    hint: 'Google AI Studio — primary provider.',
  },
  {
    id: 'groq',
    label: 'Groq API key (optional)',
    placeholder: 'gsk_…',
    hint: 'Used when Gemini is rate-limited.',
  },
  {
    id: 'cerebras',
    label: 'Cerebras API key (optional)',
    placeholder: 'ck_…',
    hint: 'Last fallback in the chain.',
  },
]

export function SettingsForm() {
  const [keys, setKeys] = useState(() => ({
    gemini: loadApiKey('gemini'),
    groq: loadApiKey('groq'),
    cerebras: loadApiKey('cerebras'),
  }))
  const [saved, setSaved] = useState(false)

  function handleChange(provider, value) {
    setKeys((prev) => ({ ...prev, [provider]: value }))
    setSaved(false)
  }

  function handleSave(event) {
    event.preventDefault()
    saveApiKey('gemini', keys.gemini)
    saveApiKey('groq', keys.groq)
    saveApiKey('cerebras', keys.cerebras)
    setSaved(true)
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-4">
        {FIELDS.map((field) => (
          <div key={field.id} className="space-y-2">
            <label htmlFor={`key-${field.id}`} className="text-sm font-medium">
              {field.label}
            </label>
            <Input
              id={`key-${field.id}`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={field.placeholder}
              value={keys[field.id]}
              onChange={(event) => handleChange(field.id, event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{field.hint}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Keys are stored only in this browser&apos;s localStorage and are sent
        only to that provider&apos;s own API endpoint — never to Supabase or
        any other server.
      </p>

      <DialogFooter>
        <Button type="submit">{saved ? 'Saved ✓' : 'Save keys'}</Button>
      </DialogFooter>
    </form>
  )
}

export default function SettingsDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI settings</DialogTitle>
          <DialogDescription>
            Add a free-tier API key. Gemini is tried first, then Groq, then
            Cerebras.
          </DialogDescription>
        </DialogHeader>
        <SettingsForm />
      </DialogContent>
    </Dialog>
  )
}
