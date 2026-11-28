import { QueryClient } from '@tanstack/react-query'

// Revisiting a view uses its recent data; explicit writes still invalidate it.
// Keep this cache in memory only: private data must not survive account changes.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 10 * 60_000, retry: 1 },
    mutations: { retry: false },
  },
})
