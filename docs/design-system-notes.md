# Design System Notes

## Goal

Keep Tailwind useful without letting visual decisions fragment across hundreds of inline class strings.

## Source of truth

The current design source of truth now lives in:

- [packages/ui/src/theme.css](/home/jason/projects/superapp/packages/ui/src/theme.css)
- [apps/web/tailwind.config.ts](/home/jason/projects/superapp/apps/web/tailwind.config.ts)
- [packages/ui/src/index.tsx](/home/jason/projects/superapp/packages/ui/src/index.tsx)

## How to evolve the design

Change these centrally when revising the visual language:

- fonts: `--font-display`, `--font-body`
- colors: `--color-*`
- radii: `--radius-*`
- shadows: `--shadow-*`
- page/shell background: `--page-background`, `--shell-background`

## Component strategy

Shared primitives should prefer semantic classes over raw one-off styling:

- `ui-card`
- `ui-button`
- `ui-button--primary`
- `ui-button--secondary`
- `ui-button--ghost`
- `ui-section-heading`
- `ui-eyebrow`
- `ui-section-title`
- `ui-input`
- `ui-panel`

## Tailwind rule of thumb

Use Tailwind for:

- layout
- spacing
- responsive behavior
- state tweaks

Avoid using raw Tailwind everywhere for:

- brand colors
- radii
- shadows
- core surface styling
- typography identity

Those should come from tokens and semantic component classes first.
