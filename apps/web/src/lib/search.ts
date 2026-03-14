import { fetchProjects } from './projects'
import { fetchMarketplaceListings } from './marketplace'
import { fetchJobs } from './jobs'
import { fetchDmThreads } from './dm'
import { fetchFeed } from './social'
import { searchSupportEntries } from './support'

export async function universalSearch(query: string, userId?: string) {
  const needle = query.trim().toLowerCase()
  const [projects, templates, services, posts, dmThreads, jobs] = await Promise.all([
    fetchProjects(),
    fetchMarketplaceListings('template'),
    Promise.all([fetchMarketplaceListings('service'), fetchMarketplaceListings('product')]).then(
      ([service, product]) => [...(service ?? []), ...(product ?? [])],
    ),
    userId ? fetchFeed(userId, 'discover') : Promise.resolve([]),
    userId ? fetchDmThreads() : Promise.resolve([]),
    fetchJobs(),
  ])

  const messages = [
    ...posts.map((item) => ({
      id: item.id,
      title: item.body || 'Untitled post',
      kind: 'post' as const,
    })),
    ...dmThreads.map((item) => ({
      id: item.id,
      title: item.title || 'Direct message',
      kind: 'dm' as const,
    })),
  ]
  const support = searchSupportEntries(needle).map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
  }))

  const allListings = [...(templates ?? []), ...services]

  if (!needle) {
    return {
      projects: projects.slice(0, 5).map((item) => ({ ...item, kind: 'project' as const })),
      listings: allListings.slice(0, 6).map((item) => ({ ...item, kind: 'listing' as const })),
      messages: messages.slice(0, 5),
      jobs: jobs.slice(0, 5).map((item) => ({ ...item, kind: 'job' as const })),
      support: support.slice(0, 5),
    }
  }

  return {
    projects: projects
      .filter((item) => item.title.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle))
      .map((item) => ({ ...item, kind: 'project' as const })),
    listings: allListings
      .filter(
        (item) =>
          item.title.toLowerCase().includes(needle) ||
          item.category.toLowerCase().includes(needle) ||
          item.summary.toLowerCase().includes(needle),
      )
      .map((item) => ({ ...item, kind: 'listing' as const })),
    messages: messages.filter((item) => item.title.toLowerCase().includes(needle)),
    jobs: jobs
      .filter((item) => item.title.toLowerCase().includes(needle) || item.customer_name.toLowerCase().includes(needle))
      .map((item) => ({ ...item, kind: 'job' as const })),
    support,
  }
}
