# Super App

Mobile-first life coordination platform built as a monorepo with a static React frontend and Supabase backend services.

## Workspaces

- `apps/web`: Vite + React + TanStack Router + Tailwind app
- `packages/ui`: shared UI components
- `packages/types`: shared domain types
- `supabase`: local Supabase config, migrations, and seeds

## Local Development

1. Install dependencies with `npm install`.
2. Start the web app with `npm run dev`.
3. Install the Supabase CLI separately, then run `supabase init` once and `supabase start` for the local backend stack.

Create an `.env.local` in `apps/web` with:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
```
