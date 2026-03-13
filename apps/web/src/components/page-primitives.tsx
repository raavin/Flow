import type { PropsWithChildren } from 'react'
import { AppCard, AppPill, SectionHeading } from '@superapp/ui'

export function HeroPanel({
  title,
  subtitle,
  badge,
  children,
}: PropsWithChildren<{ title: string; subtitle: string; badge: string }>) {
  return (
    <AppCard className="overflow-hidden bg-sprinkles">
      <div className="relative">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-berry">{badge}</p>
        <h2 className="max-w-xl font-display text-4xl text-ink">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm text-ink/70">{subtitle}</p>
        {children}
      </div>
    </AppCard>
  )
}

export function TwoColumnGrid({ children }: PropsWithChildren) {
  return <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">{children}</div>
}

export function Pill({ children, tone = 'butter' }: PropsWithChildren<{ tone?: 'butter' | 'peach' | 'teal' }>) {
  return <AppPill tone={tone}>{children}</AppPill>
}

export { AppCard, SectionHeading }
