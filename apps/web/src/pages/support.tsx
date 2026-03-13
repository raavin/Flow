import { useMemo, useState } from 'react'
import { Link, createRoute } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { AppCard, AppInput, AppPanel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { searchSupportEntries } from '@/lib/support'

function SupportPage() {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchSupportEntries(query), [query])

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Support" title="Search help and product notes" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <AppInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-10"
          placeholder="Search support, features, or coordination concepts"
        />
      </div>
        <AppPanel tone="surface" className="text-sm text-ink/65">
          This support index is stored as structured data so we can search it now and later feed it into AI support tools safely.
        </AppPanel>
        <AppPanel tone="butter" className="text-sm text-ink/75">
          Search directly here with words like <span className="font-bold">mentions</span>, <span className="font-bold">timeline</span>, <span className="font-bold">support</span>, or <span className="font-bold">ranking</span>. Slash help is mainly for the message composer.
        </AppPanel>
      </AppCard>

      <div className="grid gap-4">
        {results.map((entry) => (
          <AppCard key={entry.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="ui-eyebrow">Support note</p>
                <h2 className="ui-section-title text-2xl">{entry.title}</h2>
              </div>
              {entry.route ? (
                <Link to={entry.route as never} className="ui-button ui-button--ghost">
                  Open section
                </Link>
              ) : null}
            </div>
            <p className="text-sm text-ink/70">{entry.summary}</p>
            {entry.shortcut ? (
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-berry/70">{entry.shortcut}</p>
            ) : null}
            <AppPanel className="text-sm leading-7 text-ink/80">{entry.body}</AppPanel>
            <div className="flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
                <span key={tag} className="ui-pill text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </AppCard>
        ))}
        {!results.length ? (
          <AppCard>
            <p className="text-sm text-ink/60">No support entries match that search yet.</p>
          </AppCard>
        ) : null}
      </div>
    </div>
  )
}

export const supportRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'support',
  component: SupportPage,
})
