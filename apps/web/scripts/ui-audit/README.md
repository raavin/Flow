# Isolated UI preview

Run `npm run audit:ui --workspace @superapp/web` from the repo root. Open `/app/calendar`, `/app/gantt`, `/app/budgets`, `/app/wallet`, `/app/coordination` or `/app/projects/sample-party/budget`.

This configuration substitutes a synthetic signed-in profile and in-memory query fixtures. It makes no Supabase requests and rejects writes. It is for visual inspection only, not an authentication or integration test. The default `dev` and `build` scripts do not load these substitutes. Do not deploy an audit build.
