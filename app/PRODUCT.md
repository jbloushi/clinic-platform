# PRODUCT.md — Clinic Platform brief

One-time brief so design/code passes don't re-derive context. Read with `DESIGN.md`.

## What this is

Patient-facing booking + clinic operations + doctor workspace, on top of a live local OpenEMR 8.0
(source of clinical truth). Demo instance today; Gulf-region clinic SaaS trajectory (Arabic/English
markets — RTL is a future concern, don't preclude it with direction-hardcoded layouts).

## Users & register

- **Patients** (95%+ mobile): book in under a minute. Brand register on public pages — warm,
  trustworthy, zero jargon. OTP demo code `123456`.
- **Doctors** (also mobile-heavy): between-patients glances. Product register — schedule first,
  minimal taps, no decoration.
- **Reception/admin/finance** (desktop): dense tables, keyboard-friendly. Product register.

## Voice

Plain, confident, short. "You're booked." not "Your appointment has been successfully scheduled."
No exclamation marks in product mode. Prices/times always explicit.

## Anti-references (actively avoid)

- Generic "AI SaaS" look: gradient text headlines, purple-on-dark, glassmorphism everywhere,
  uniform over-rounded cards, ghost cards with 3 words and 200px of padding.
- Consumer-health cutesiness: emoji, illustration mascots, pastel blobs behind everything.
- Hospital-brochure sterility: stock photos of smiling doctors in corridors. We use gradient
  initials avatars deliberately — no photos.
- Dark patterns: fake urgency ("2 slots left!"), fake reviews. The deterministic demo ratings in
  `lib/doctor-meta.ts` are placeholders and must be swapped before any real deployment.

## Hard constraints

- OpenEMR is the system of record for patients/appointments/records; platform DB (Prisma/SQLite)
  owns identity, wallet, bookings, services. Never cache patient-identifying data process-wide.
- Everything patient/doctor-facing must pass at 375px with no horizontal scroll.
- `prefers-reduced-motion` and WCAG AA contrast are non-negotiable.
