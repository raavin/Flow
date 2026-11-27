import { supabase } from './supabase'
import { searchSupportEntries } from './support'
import { postPlainText } from './post-content'
type SearchResult = {
  people: { id: string; handle: string; display_name: string | null }[]
  topics: { id: string; slug: string; label: string }[]
  projects: { id: string; title: string }[]
  listings: { id: string; title: string }[]
  jobs: { id: string; title: string }[]
  messages: { id: string; title: string; kind: 'post' | 'dm' }[]
}
export async function universalSearch(query: string) {
  let result: SearchResult = {
    people: [],
    topics: [],
    projects: [],
    listings: [],
    jobs: [],
    messages: [],
  }
  if (supabase) {
    const { data, error } = await supabase.rpc('search_flow', {
      p_query: query.trim(),
    })
    if (error) throw error
    result = data as SearchResult
  }
  return {
    ...result,
    messages: result.messages.map((item) => ({
      ...item,
      title: postPlainText(item.title),
    })),
    support: searchSupportEntries(query).slice(0, 20),
  }
}
