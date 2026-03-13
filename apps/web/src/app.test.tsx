import './test-setup'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'

describe('app shell', () => {
  it('renders the landing hero', async () => {
    router.navigate({ to: '/' })

    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText(/friendly flow for everything you are making happen/i)).toBeInTheDocument()
  })
})
