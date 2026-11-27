import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppTextarea, SectionHeading } from '@superapp/ui'
import { useAppStore } from '@/hooks/useAppStore'
import { MutationFeedback } from './request-feedback'
export function BusinessSettings() {
  const { profile, businessProfile, saveOnboarding } = useAppStore()
  const [name, setName] = useState(businessProfile?.business_name ?? '')
  const [category, setCategory] = useState(businessProfile?.category ?? '')
  const [area, setArea] = useState(businessProfile?.service_area ?? '')
  const [notes, setNotes] = useState(businessProfile?.availability_notes ?? '')
  const save = useMutation({
    mutationFn: () =>
      saveOnboarding({
        accountMode: 'both',
        firstName: profile!.first_name,
        lastName: profile!.last_name ?? '',
        location: profile!.location,
        timeZone: profile!.time_zone,
        useCases: profile!.use_cases,
        integrations: profile!.integrations,
        businessName: name.trim(),
        category,
        serviceArea: area,
        availabilityNotes: notes,
        offerings: businessProfile?.offerings ?? [],
        bookingModel: businessProfile?.booking_model ?? 'request-based',
        visibilityMode: businessProfile?.visibility_mode ?? 'progress milestones',
      }),
  })
  return (
    <AppCard className="space-y-3">
      <details>
        <summary className="cursor-pointer min-h-11 py-2 text-lg font-semibold">Business profile</summary>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <SectionHeading title={businessProfile ? 'Edit business' : 'Set up a business'} />
          <label className="grid gap-1">
            Business name
            <AppInput required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="grid gap-1">
            Category
            <AppInput value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <label className="grid gap-1">
            Service area
            <AppInput value={area} onChange={(e) => setArea(e.target.value)} />
          </label>
          <label className="grid gap-1">
            Availability
            <AppTextarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <MutationFeedback mutation={save} success="Business profile saved." />
          <AppButton type="submit" disabled={save.isPending || !name.trim()}>
            Save business
          </AppButton>
        </form>
      </details>
    </AppCard>
  )
}
