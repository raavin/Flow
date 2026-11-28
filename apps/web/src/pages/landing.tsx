import { landingRoute } from '@/route-definitions'
import { AccountError } from '@/components/account-error'
import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MessageCircle, CalendarDays, FolderKanban } from 'lucide-react'
import { AppButton, AppCard, AppInput, FieldLabel, SectionHeading } from '@superapp/ui'

import { HeroPanel } from '@/components/page-primitives'
import { useAppStore } from '@/hooks/useAppStore'

export function LandingPage() {
  const { returnTo } = landingRoute.useSearch()
  const { signIn, signUp, session, profile, loading, accountError, retryAccount } = useAppStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && session && !accountError) {
      if (profile) void navigate({ to: returnTo ?? '/app/messages', replace: true })
      else void navigate({ to: '/onboarding', search: { returnTo }, replace: true })
    }
  }, [accountError, loading, navigate, profile, returnTo, session])

  async function submit() {
    setError(null)
    setNotice('')
    setSubmitting(true)
    try {
      if (mode === 'sign-up') {
        await signUp(email, password)
        setNotice('If email confirmation is required, check your inbox to finish signing up.')
        return
      }

      await signIn(email, password)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (accountError) return <AccountError message={accountError} onRetry={retryAccount} />

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-8 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <HeroPanel
          badge="Flow"
          title="Flow"
          subtitle="Follow people, join conversations and share what interests you. Create a task or project when you want to take an idea further."
        >
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Messages', Icon: MessageCircle },
              { label: 'Calendar', Icon: CalendarDays },
              { label: 'Projects', Icon: FolderKanban },
            ].map(({ label, Icon }) => (
              <AppCard key={label} className="bg-white/80">
                <Icon className="mb-3 h-6 w-6 text-berry" />
                <p className="text-sm font-bold">{label}</p>
              </AppCard>
            ))}
          </div>
        </HeroPanel>

        <AppCard className="space-y-5">
          <SectionHeading eyebrow="Welcome" title={mode === 'sign-up' ? 'Create account' : 'Sign in'} />
          <div className="flex gap-2">
            <AppButton
              aria-pressed={mode === 'sign-up'}
              variant={mode === 'sign-up' ? 'primary' : 'ghost'}
              onClick={() => setMode('sign-up')}
            >
              Create account
            </AppButton>
            <AppButton
              aria-pressed={mode === 'sign-in'}
              variant={mode === 'sign-in' ? 'primary' : 'ghost'}
              onClick={() => setMode('sign-in')}
            >
              Sign in
            </AppButton>
          </div>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <FieldLabel>
              Email
              <AppInput
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 border border-ink/10"
              />
            </FieldLabel>
            <FieldLabel>
              Password
              <AppInput
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                placeholder="Enter a password"
                className="mt-2 border border-ink/10"
              />
            </FieldLabel>
            <div className="grid gap-3">
              <AppButton type="submit" disabled={submitting || !email.trim() || !password}>
                {submitting ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
              </AppButton>
            </div>
          </form>
          {notice ? (
            <p role="status" className="text-sm text-teal">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-2xl bg-berry/10 p-3 text-sm text-berry">
              {error}
            </p>
          ) : null}
          <p className="text-xs text-ink/60">
            Keep a thought private, share it with your followers, or build a plan with your project team.
          </p>
        </AppCard>
      </div>
    </div>
  )
}
