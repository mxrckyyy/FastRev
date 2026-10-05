import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SettingsForm } from '@/pages/Settings'

// /settings route — reuses the exact SettingsForm the dialog shows, so the
// sidebar/user-menu destination and the Upload quick-action stay in sync.
export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle>AI settings</CardTitle>
          <CardDescription>
            Add a free-tier API key. Gemini is tried first, then Groq, then
            Cerebras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm />
        </CardContent>
      </Card>
    </div>
  )
}
