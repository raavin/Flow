import { useEffect, useState } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { Sparkles, TentTree, WandSparkles } from 'lucide-react'
import { AppButton, AppCard, AppInput, FieldLabel, SectionHeading } from '@superapp/ui'
import { rootRoute } from '@/components/layout'
import { HeroPanel } from '@/components/page-primitives'
import { useAppStore } from '@/hooks/useAppStore'

function LandingPage() {
  const { signIn, signUp, session, profile, loading } = useAppStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && session) {
      const destination = profile ? '/app/messages' : '/onboarding'
      void navigate({ to: destination })
    }
  }, [loading, navigate, profile, session])

  async function submit() {
    setError(null)
    try {
      if (mode === 'sign-up') {
        await signUp(email, password)
        return
      }

      await signIn(email, password)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Something went sideways.')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-8 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <HeroPanel
          badge="Flow"
          title="A friendly flow for everything you are making happen."
          subtitle="Coordinate people, calendars, tasks, bookings, templates, and helpful nudges in one bright place."
        >
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Plan real life', Icon: Sparkles },
              { label: 'Coordinate people & business', Icon: TentTree },
              { label: 'Book, buy, and keep it moving', Icon: WandSparkles },
            ].map(({ label, Icon }) => (
              <AppCard key={label} className="bg-white/80">
                <Icon className="mb-3 h-6 w-6 text-berry" />
                <p className="text-sm font-bold">{label}</p>
              </AppCard>
            ))}
          </div>
        </HeroPanel>

        <AppCard className="space-y-5">
          <SectionHeading eyebrow="Welcome" title="Step inside" />
          <div className="flex gap-2">
            <AppButton variant={mode === 'sign-up' ? 'primary' : 'ghost'} onClick={() => setMode('sign-up')}>
              Create account
            </AppButton>
            <AppButton variant={mode === 'sign-in' ? 'primary' : 'ghost'} onClick={() => setMode('sign-in')}>
              Sign in
            </AppButton>
          </div>
          <FieldLabel>
            Email
            <AppInput
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
              placeholder="Enter a password"
              className="mt-2 border border-ink/10"
            />
          </FieldLabel>
          <div className="grid gap-3">
            <AppButton onClick={() => void submit()}>
              {mode === 'sign-up' ? 'Create account' : 'Sign in'}
            </AppButton>
            <AppButton variant="ghost" onClick={() => navigate({ to: '/onboarding' })}>
              Peek at onboarding
            </AppButton>
          </div>
          {error ? <p className="rounded-2xl bg-berry/10 p-3 text-sm text-berry">{error}</p> : null}
          <p className="text-xs text-ink/60">
            Authentication now uses the local Supabase project. Passwords are handled by Supabase Auth and never stored in the browser app.
          </p>
        </AppCard>
      </div>
    </div>
  )
}

export const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
})
