import { onboardingRoute } from '@/route-definitions'
import { AccountError } from '@/components/account-error'
import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AppButton, AppCard, AppInput, SectionHeading } from '@superapp/ui'

import { useAppStore } from '@/hooks/useAppStore'
export function OnboardingPage() {
  const { returnTo } = onboardingRoute.useSearch()
  const { session, profile, saveOnboarding, loading, accountError, retryAccount } = useAppStore()
  const navigate = useNavigate()
  const [name, setName] = useState(profile?.first_name ?? '')
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!loading && !session && !accountError) void navigate({ to: '/', search: { returnTo } })
  }, [session, loading, navigate, accountError, returnTo])
  async function submit() {
    setError('')
    const issue = validateHandle(handle)
    if (issue) {
      setError(issue)
      return
    }
    setBusy(true)
    try {
      await saveOnboarding({
        accountMode: profile?.account_mode ?? 'individual',
        firstName: name.trim(),
        handle: handle.trim(),
        location: profile?.location ?? '',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        useCases: profile?.use_cases ?? [],
        integrations: profile?.integrations ?? [],
      })
      void navigate({ to: returnTo ?? '/app/messages', replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.')
    } finally {
      setBusy(false)
    }
  }
  if (accountError) return <AccountError message={accountError} onRetry={retryAccount} />
  if (loading)
    return (
      <p role="status" className="p-6">
        Loading account…
      </p>
    )
  return (
    <div className="mx-auto max-w-lg p-4 py-10">
      <AppCard>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <SectionHeading title="Your profile" />
          <label className="grid gap-1 font-semibold">
            Display name
            <AppInput
              required
              autoComplete="nickname"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="grid gap-1 font-semibold">
            Username
            <AppInput
              required
              autoCapitalize="none"
              autoComplete="username"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              maxLength={30}
            />
            <span className="text-sm font-normal text-ink/60">
              People can find and mention you using @{handle || 'username'}.
            </span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-berry">
              {error}
            </p>
          )}
          <AppButton type="submit" disabled={busy || !name.trim() || !handle.trim()}>
            {busy ? 'Saving…' : 'Continue'}
          </AppButton>
        </form>
      </AppCard>
    </div>
  )
}
function validateHandle(handle: string) {
  if (!handle) return null
  if (handle.length < 3) return 'Username must be at least 3 characters.'
  if (handle.length > 30) return 'Username must be 30 characters or fewer.'
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(handle))
    return 'Only lowercase letters, numbers, underscores, hyphens and dots.'
  return null
}
