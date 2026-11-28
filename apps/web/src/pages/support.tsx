import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { AppCard, AppInput, AppPanel, SectionHeading } from '@superapp/ui'

import { searchSupportEntries } from '@/lib/support'

export function SupportPage() {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchSupportEntries(query), [query])

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading level={1} title="Help" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <AppInput
            aria-label="Search help"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-10"
            placeholder="Search help"
          />
        </div>
      </AppCard>

      <div className="grid gap-4">
        {results.map((entry) => (
          <section key={entry.id} id={entry.id} className="scroll-mt-4">
            <AppCard className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
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
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-berry/70">
                  {entry.shortcut}
                </p>
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
          </section>
        ))}
        {!results.length ? (
          <AppCard>
            <p className="text-sm text-ink/60">No results. Try a different search.</p>
          </AppCard>
        ) : null}
      </div>
    </div>
  )
}
