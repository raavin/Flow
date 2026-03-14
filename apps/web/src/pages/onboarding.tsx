import { useEffect, useState } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { AppButton, AppCard, AppInput, AppTextarea, FieldLabel, SectionHeading } from '@superapp/ui'
import { rootRoute } from '@/components/layout'
import { Pill } from '@/components/page-primitives'
import { useAppStore } from '@/hooks/useAppStore'
import type { AccountMode } from '@superapp/types'

const personalUseCases = ['moving house', 'birthdays', 'coffee catch-ups', 'weddings', 'travel', 'family scheduling']
const businessOfferings = ['services', 'products', 'templates', 'custom workflows']
const integrationsList = ['calendar', 'contacts', 'notifications', 'payments']

function OnboardingPage() {
  const { session, profile, businessProfile, saveOnboarding, loading } = useAppStore()
  const [mode, setMode] = useState<AccountMode>('both')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [handle, setHandle] = useState('')
  const [handleTouched, setHandleTouched] = useState(false)
  const [location, setLocation] = useState('')
  const [timeZone, setTimeZone] = useState('')
  const [useCases, setUseCases] = useState<string[]>(['moving house'])
  const [integrations, setIntegrations] = useState<string[]>(['calendar'])
  const [businessName, setBusinessName] = useState('')
  const [category, setCategory] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [offerings, setOfferings] = useState<string[]>(['templates', 'services'])
  const [bookingModel, setBookingModel] = useState('')
  const [availabilityNotes, setAvailabilityNotes] = useState('')
  const [visibilityMode, setVisibilityMode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (profile) {
      setMode(profile.account_mode)
      setFirstName(profile.first_name)
      setLastName(profile.last_name ?? '')
      setLocation(profile.location)
      setTimeZone(profile.time_zone)
      setUseCases(profile.use_cases)
      setIntegrations(profile.integrations)
    }
    if (businessProfile) {
      setBusinessName(businessProfile.business_name)
      setCategory(businessProfile.category)
      setServiceArea(businessProfile.service_area)
      setOfferings(businessProfile.offerings)
      setBookingModel(businessProfile.booking_model)
      setAvailabilityNotes(businessProfile.availability_notes)
      setVisibilityMode(businessProfile.visibility_mode)
    }
  }, [businessProfile, profile])

  useEffect(() => {
    if (!loading && !session) {
      void navigate({ to: '/' })
    }
  }, [loading, navigate, session])

  async function submit() {
    setError(null)
    try {
      const handleError = validateHandle(handle)
      if (handleError) { setError(handleError); return }
      await saveOnboarding({
        accountMode: mode,
        firstName,
        lastName,
        handle: handle.trim() || undefined,
        location,
        timeZone,
        useCases,
        integrations,
        businessName,
        category,
        serviceArea,
        offerings,
        bookingModel,
        availabilityNotes,
        visibilityMode,
      })
      navigate({ to: '/app/messages' })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save your setup.')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <AppCard className="space-y-5">
          <SectionHeading eyebrow="Step 1" title="Choose your orbit" />
          <div className="grid gap-3">
            {(['individual', 'business', 'both'] as AccountMode[]).map((option) => (
              <button
                key={option}
                onClick={() => setMode(option)}
                className={`rounded-[24px] border px-4 py-4 text-left transition ${
                  mode === option ? 'border-ink bg-butter' : 'border-ink/10 bg-cloud'
                }`}
              >
                <p className="text-lg font-extrabold capitalize text-ink">{option}</p>
                <p className="text-sm text-ink/65">
                  {option === 'individual' && 'Plan your life, events, and shared projects.'}
                  {option === 'business' && 'Offer services, products, and client coordination.'}
                  {option === 'both' && 'Float gracefully between personal planning and business delivery.'}
                </p>
              </button>
            ))}
          </div>
          <FieldLabel>
            First name
            <AppInput value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-2" />
          </FieldLabel>
          <FieldLabel>
            Last name
            <AppInput value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-2" />
          </FieldLabel>
          <FieldLabel>
            Handle
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/40">@</span>
              <AppInput
                value={handle}
                onChange={(event) => {
                  setHandleTouched(true)
                  setHandle(slugifyHandle(event.target.value))
                }}
                onFocus={() => {
                  if (!handleTouched && !handle) setHandle(suggestHandle(firstName, lastName))
                }}
                className="mt-0"
                style={{ paddingLeft: '1.75rem' }}
                placeholder={suggestHandle(firstName, lastName) || 'yourhandle'}
              />
            </div>
            {handle && validateHandle(handle) ? (
              <p className="mt-1 text-xs text-berry">{validateHandle(handle)}</p>
            ) : handle ? (
              <p className="mt-1 text-xs text-ink/50">@{handle}</p>
            ) : null}
          </FieldLabel>
          <FieldLabel>
            Location
            <AppInput value={location} onChange={(event) => setLocation(event.target.value)} className="mt-2" />
          </FieldLabel>
          <FieldLabel>
            Time zone
            <AppInput value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className="mt-2" />
          </FieldLabel>
        </AppCard>

        <div className="space-y-4">
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Individual" title="Use cases and integrations" />
            <div className="flex flex-wrap gap-2">
              {personalUseCases.map((item) => (
                <button key={item} onClick={() => setUseCases(toggleItem(useCases, item))}>
                  <Pill tone={useCases.includes(item) ? 'butter' : 'teal'}>{item}</Pill>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {integrationsList.map((item) => (
                <button key={item} onClick={() => setIntegrations(toggleItem(integrations, item))}>
                  <Pill tone={integrations.includes(item) ? 'peach' : 'teal'}>{item}</Pill>
                </button>
              ))}
            </div>
          </AppCard>

          {(mode === 'business' || mode === 'both') ? (
            <AppCard className="space-y-4">
              <SectionHeading eyebrow="Business" title="Offerings and visibility" />
              <FieldLabel>
                Business name
                <AppInput value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="mt-2" />
              </FieldLabel>
              <FieldLabel>
                Category
                <AppInput value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2" />
              </FieldLabel>
              <FieldLabel>
                Service area
                <AppInput value={serviceArea} onChange={(event) => setServiceArea(event.target.value)} className="mt-2" />
              </FieldLabel>
              <div className="flex flex-wrap gap-2">
                {businessOfferings.map((item) => (
                  <button key={item} onClick={() => setOfferings(toggleItem(offerings, item))}>
                    <Pill tone={offerings.includes(item) ? 'peach' : 'teal'}>{item}</Pill>
                  </button>
                ))}
              </div>
              <FieldLabel>
                Booking model
                <AppInput value={bookingModel} onChange={(event) => setBookingModel(event.target.value)} className="mt-2" />
              </FieldLabel>
              <FieldLabel>
                Availability notes
                <AppTextarea value={availabilityNotes} onChange={(event) => setAvailabilityNotes(event.target.value)} className="mt-2 min-h-24" />
              </FieldLabel>
              <FieldLabel>
                Visibility mode
                <AppInput value={visibilityMode} onChange={(event) => setVisibilityMode(event.target.value)} className="mt-2" />
              </FieldLabel>
            </AppCard>
          ) : null}

          {error ? <p className="rounded-[24px] bg-berry/10 p-4 text-sm text-berry">{error}</p> : null}
          <AppButton className="w-full" onClick={() => void submit()}>
            Save setup and open dashboard
          </AppButton>
        </div>
      </div>
    </div>
  )
}

function toggleItem(items: string[], value: string) {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value]
}

function slugifyHandle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 30)
}

function suggestHandle(firstName: string, lastName: string) {
  return slugifyHandle((firstName + lastName).replace(/\s/g, ''))
}

function validateHandle(handle: string) {
  if (!handle) return null
  if (handle.length < 3) return 'Handle must be at least 3 characters.'
  if (handle.length > 30) return 'Handle must be 30 characters or fewer.'
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(handle)) return 'Only lowercase letters, numbers, underscores, hyphens and dots.'
  return null
}

export const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  component: OnboardingPage,
})
