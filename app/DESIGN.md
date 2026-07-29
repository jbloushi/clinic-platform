# DESIGN.md — Clinic Platform visual system

Source of truth for all UI work. **Lower models: follow this; do not re-derive or "improve" the
system itself.** Tokens live in `src/app/globals.css`; component conventions below.

## Palette

- **Primary**: deep clinic teal `#0B5C55`; dark teal `#08423D`; gold accent `#C0983F`.
- **Surfaces**: warm page `#F4F1EA`, warm canvas `#E7E3DA`, white and soft-white cards.
- **Text**: deep green-black `#143430`; muted copy `#6B7A76`.
- The approved teal/gold/warm-sand direction supersedes the original blue planning palette.
- The specialty color system may distinguish specialties, but it must not override clinic chrome.
- **Status colors** (appointments): single source in globals.css `--status-*` vars, rendered only
  via `StatusBadge` (`components/domain/status-badge.tsx`). Never inline appointment-status colors.
- Semantic tokens only in components (`bg-primary`, `text-muted-foreground`, `border-border`…).
  Raw Tailwind hues (e.g. `text-emerald-600`) are allowed ONLY for: specialty colors (via the lib),
  success/danger accents on icons, and the availability dot.

## Type

- Major headings, doctor names, dates, and prices: Source Serif 4 with Arabic editorial fallbacks.
- Navigation, labels, forms, tables, and body: IBM Plex Sans with Arabic sans fallbacks.
- Scale in use: 11px labels (uppercase, tracking-wide) · 13px nav · 14px body (`text-sm`) ·
  15–16px card titles · 22–24px page titles (`PageHeader`) · 36–48px landing hero only.
- Numbers in tables/prices/times: always `tabular-nums` (globally applied to th/td; add the class
  on standalone stats).
- Weights: 400 body, 500 labels/nav, 600 headings/values. Nothing heavier than 600 except hero.

## Spacing & shape

- 4px grid. Card padding `p-5`/`p-6`; section gaps `space-y-6`; page shell `max-w-6xl px-4`.
- Card radius is 14–16px; controls are 11–12px; pills remain fully rounded.
- Elevation: `shadow-sm` resting, `shadow-md` on `.card-hover` hover. No heavier shadows.

## Motion

- Tokens: `--motion-fast: 120ms`, `--motion-base: 180ms`, `--motion-slow: 260ms`,
  ease `--ease-out-quart`. Utilities: `.card-hover` (lift + border tint), `.press-scale` (0.985).
- `prefers-reduced-motion` is honored globally — never add animation that bypasses it.
- Budget: max 1–2 animated elements per view. No scroll-triggered animation in product mode.

## Component conventions

- Primitives in `components/ui/*` (shadcn-style); domain pieces in `components/domain/*`:
  `PageHeader` (eyebrow/icon/title/description/actions), `StatCard`, `StatusBadge`,
  `InitialsAvatar` (gradient prop = specialty color; NO photos), `DoctorCard`, `Stepper`,
  `EmptyState`/`ErrorState`/`LoadingState` (ring-halo icon style), `BrandMark`/`BrandWordmark`.
- Icons: lucide-react only, `h-4 w-4` inline / `h-5 w-5` feature, one stroke weight. Never emoji.
- Focus: global `:focus-visible` ring (2px, offset 2) — don't suppress, don't reinvent.
- Touch targets ≥ 44px on patient/doctor surfaces (95% mobile).
- `backdrop-blur` is allowed ONLY on sticky headers and the mobile bottom nav.

## Registers (which bar applies where)

- **Brand mode** — `/` (landing), `/doctors`, `/doctors/[id]`, `/book/*`, `/login`: expressive
  allowed (hero glow, gradient avatars, delight moments), but calm-clinical; trust > flash.
- **Product mode** — `/ops/*`, `/doctor/*`, `/account/*`, `/staff/login`: clarity and density
  first. No decorative motion, no new colors, tables and forms follow the primitives exactly.
