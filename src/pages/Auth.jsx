import { useState } from 'react'
import {
  CircleCheck,
  Eye,
  EyeOff,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import {
  friendlyAuthError,
  validateAuthEmail,
  validateAuthPassword,
} from '@/lib/authForm'

const HEADINGS = {
  login: 'Welcome back',
  signup: 'Create your account',
}
const SUBMIT_LABELS = { login: 'Sign in', signup: 'Create account' }
const BUSY_LABELS = { login: 'Signing in…', signup: 'Creating account…' }
const SWITCH_PROMPTS = {
  login: "Don't have an account?",
  signup: 'Already have an account?',
}
const SWITCH_ACTIONS = { login: 'Create account', signup: 'Sign in' }

/**
 * Presentational auth screen (named export so states can be rendered in
 * isolation by smoke tests). All state and auth calls live in `Auth`.
 *
 * One shared form drives both modes — mode only changes copy, autocomplete
 * and validation rules, so login/signup never drift apart.
 */
export function AuthView({
  mode,
  email,
  password,
  emailError,
  passwordError,
  serverError,
  submitting,
  showPassword,
  confirmationEmail,
  onSubmit,
  onSwitchMode,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
}) {
  const nextMode = mode === 'login' ? 'signup' : 'login'
  const passwordLabel = showPassword ? 'Hide password' : 'Show password'

  if (confirmationEmail) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
        <div className="absolute top-3 right-3">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader className="justify-items-center text-center">
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"
            >
              <Sparkles className="size-5" />
            </span>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              FastRev
            </h1>
            <CardDescription>
              Spaced-repetition review for students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div role="status" className="flex flex-col items-center gap-4 text-center">
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success"
              >
                <CircleCheck className="size-6" />
              </span>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation link to{' '}
                  <span className="break-all font-medium text-foreground">
                    {confirmationEmail}
                  </span>
                  . Open it to activate your account, then come back and sign
                  in.
                </p>
              </div>
              <Button
                variant="outline"
                className="h-10 w-full"
                onClick={() => onSwitchMode('login')}
              >
                Back to sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none">
        <CardHeader className="justify-items-center text-center">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          >
            <Sparkles className="size-5" />
          </span>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">FastRev</h1>
          <CardDescription>
            Spaced-repetition review for students
          </CardDescription>
        </CardHeader>

        <CardContent>
          <h2 id="auth-heading" tabIndex={-1} className="text-lg font-semibold">
            {HEADINGS[mode]}
          </h2>

          <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="auth-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@example.com"
                className="h-10 px-3"
                value={email}
                onChange={onEmailChange}
                disabled={submitting}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? 'auth-email-error' : undefined}
              />
              {emailError && (
                <p id="auth-email-error" className="text-sm text-destructive">
                  {emailError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="auth-password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Input
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  placeholder="••••••••"
                  className="h-10 px-3 pr-10"
                  value={password}
                  onChange={onPasswordChange}
                  disabled={submitting}
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={
                    passwordError ? 'auth-password-error' : undefined
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 size-8 text-muted-foreground hover:text-foreground"
                  onClick={onTogglePassword}
                  disabled={submitting}
                  aria-label={passwordLabel}
                  title={passwordLabel}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </Button>
              </div>
              {passwordError ? (
                <p id="auth-password-error" className="text-sm text-destructive">
                  {passwordError}
                </p>
              ) : mode === 'signup' ? (
                <p className="text-xs text-muted-foreground">
                  At least 6 characters.
                </p>
              ) : null}
            </div>

            {serverError && (
              <div
                role="alert"
                className="flex animate-in items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive fade-in-0 duration-150"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>{serverError}</p>
              </div>
            )}

            <Button
              id="auth-submit"
              type="submit"
              size="lg"
              className="h-10 w-full"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting && (
                <LoaderCircle
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              {submitting ? BUSY_LABELS[mode] : SUBMIT_LABELS[mode]}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {SWITCH_PROMPTS[mode]}{' '}
            <button
              type="button"
              onClick={() => onSwitchMode(nextMode)}
              disabled={submitting}
              className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline"
            >
              {SWITCH_ACTIONS[mode]}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Auth page: owns form state, client-side validation and the Supabase
 * calls (via useAuth). Sign-in success is handled by AuthProvider — the
 * GuestRoute guard redirects to /dashboard once `user` updates.
 */
export default function Auth() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState(null)
  const [passwordError, setPasswordError] = useState(null)
  const [serverError, setServerError] = useState(null)
  const [confirmationEmail, setConfirmationEmail] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function focusElement(id) {
    document.getElementById(id)?.focus()
  }

  function handleEmailChange(event) {
    const value = event.target.value
    setEmail(value)
    setServerError(null)
    if (emailError) setEmailError(validateAuthEmail(value))
  }

  function handlePasswordChange(event) {
    const value = event.target.value
    setPassword(value)
    setServerError(null)
    if (passwordError) setPasswordError(validateAuthPassword(value, mode))
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setEmailError(null)
    setPasswordError(null)
    setServerError(null)
    setConfirmationEmail(null)
    // Land focus on the new mode's heading so the change is announced
    // instead of dropping keyboard users back at the top of the page.
    requestAnimationFrame(() => focusElement('auth-heading'))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const nextEmailError = validateAuthEmail(email)
    const nextPasswordError = validateAuthPassword(password, mode)
    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)
    if (nextEmailError || nextPasswordError) {
      focusElement(nextEmailError ? 'auth-email' : 'auth-password')
      return
    }

    setServerError(null)
    setSubmitting(true)
    try {
      const trimmedEmail = email.trim()
      const result =
        mode === 'login'
          ? await signIn(trimmedEmail, password)
          : await signUp(trimmedEmail, password)

      if (result?.error) {
        setServerError(friendlyAuthError(result.error))
        // The submit button was disabled during the request, which drops
        // focus — put it back so the announced error has a context.
        requestAnimationFrame(() => focusElement('auth-submit'))
      } else if (result?.needsConfirmation) {
        setConfirmationEmail(trimmedEmail)
      }
      // Successful sign-in: AuthProvider updates `user`, GuestRoute redirects.
    } catch (err) {
      setServerError(friendlyAuthError(err))
      requestAnimationFrame(() => focusElement('auth-submit'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthView
      mode={mode}
      email={email}
      password={password}
      emailError={emailError}
      passwordError={passwordError}
      serverError={serverError}
      submitting={submitting}
      showPassword={showPassword}
      confirmationEmail={confirmationEmail}
      onSubmit={handleSubmit}
      onSwitchMode={switchMode}
      onEmailChange={handleEmailChange}
      onPasswordChange={handlePasswordChange}
      onTogglePassword={() => setShowPassword((value) => !value)}
    />
  )
}
