# Design Quality Plan — Impeccable levers × /code-review, token-rationed

Companion to `docs/PERFORMANCE_PLAN.md` (do not interleave — finish a phase there or here before
starting one in the other file). Goal: raise UI quality using **named design levers** executed on
**cheap models**, with a `/code-review` gate after every phase.

## Why this rations tokens

1. **The system is pre-derived.** `app/DESIGN.md` (visual system) and `app/PRODUCT.md` (brief,
   registers, anti-references) were written once on the top model. Every phase below starts with
   "Read app/DESIGN.md + app/PRODUCT.md" — cheap models follow the system instead of reinventing
   it, which is both cheaper and better.
2. **Named levers, not adjectives.** Each phase is one lever (typeset / layout / distill / detect /
   polish…) on one surface. Precise scope = small diffs = small review context = cheap.
3. **`/code-review` at LOW effort** after each phase (small diff → low effort is sufficient and
   ~⅓ the cost of medium). Only escalate to medium if low reports a CONFIRMED correctness bug.
4. **No subagent spawns.** Every spawn re-derives context cold. All phases run inline.
5. **Verification on Haiku.** Screenshot/curl checks are mechanical — never burn Sonnet/Opus on them.

## Model-switch protocol

Same as PERFORMANCE_PLAN: at each phase boundary the agent says *"Switch to <model> now
(/model <id>)"* and pauses. If the current model already matches, proceed without asking.

**Floor is Sonnet 5, not Haiku.** Haiku's context window is too limited for this codebase (the
Browser-pane tool calls, file reads, and multi-file diffs in a phase eat the window fast — Phase B
already showed the screenshot tool degrading under it). Haiku is fine for truly trivial one-shot
greps/curls done as a sub-step, but every phase below runs on Sonnet 5 as the baseline.

| Phase | Lever(s) | Surface | Model | /model id |
|---|---|---|---|---|
| A | detect + system docs | whole app | **Fable/Opus** | — ✅ DONE |
| B | detect-fixes | DoctorCard radius | Sonnet 5 (ran on Haiku) | ✅ DONE — commit `3492af7` |
| C | code-review debt | 3 open findings | **Sonnet 5** | `claude-sonnet-5` |
| D | typeset + layout | product mode (ops/doctor) | **Sonnet 5** | `claude-sonnet-5` |
| E | polish + delight | brand mode (landing/booking) | **Sonnet 5** | `claude-sonnet-5` |
| F | verify + review gate | whole app | **Sonnet 5** | `claude-sonnet-5` |

Every phase ends: `npx tsc --noEmit` clean → `/code-review` low → commit. Keep phases
independently revertable.

---

## Phase A — detect scan + DESIGN.md/PRODUCT.md ✅ DONE (Fable, this session)

Slop-detect results (baseline): **no gradient text**, gradients confined to avatars/brand mark
(purposeful), `backdrop-blur` only on sticky headers/bottom nav (justified). Palette is "safe blue"
by design — correct register for medical; point of view carried by the specialty color system.
**Findings to fix:** (1) DoctorCard introduced `rounded-2xl` + `rounded-xl`, breaking the
`rounded-lg` system; (2) three unapplied /code-review findings (Phase C).

Deliverables: `app/DESIGN.md`, `app/PRODUCT.md`, this plan.

---

## Phase B — detect-fixes (radius consistency)  ▶ SONNET 5 — ✅ DONE

Mechanical. Read `app/DESIGN.md` §Spacing & shape first.

- **B.1** `src/components/domain/doctor-card.tsx`: change `rounded-2xl` on the Card to `rounded-lg`
  (or simply remove the override — Card already defaults to `rounded-lg`); remove `rounded-xl`
  from the Book button (Button default is correct).
- **B.2** Re-run the detect greps from Phase A (`grep -rho "rounded-\(2xl\|xl\|3xl\)"`,
  `bg-clip-text`, `text-transparent`) — must return zero deviations.
- **B.3** Verify at 375px in preview: DoctorCard on `/doctors` unchanged except corner radius.

**Acceptance:** greps clean; `tsc` clean; `/code-review` low returns no findings; commit.

---

## Phase C — apply open /code-review findings  ▶ SONNET 5 — ✅ DONE (commit `960b764`)

Three findings from the `f5e4f77` review, with exact instructions so no judgment is needed:

- **C.1 (reuse)** `formatWhen` is duplicated in `src/app/page.tsx` and `src/app/doctors/page.tsx`.
  Move ONE copy into `src/lib/doctor-meta.ts` as an exported function; import it in both pages;
  delete both local copies.
- **C.2 (altitude)** `availabilityTone()` in `src/lib/doctor-meta.ts` regex-matches the display
  string (`/today/i`). Replace with date logic: change signature to
  `availabilityTone(nextAvailableIso?: string)` taking the raw ISO slot start; return `'today'`
  when `new Date(iso).toDateString() === new Date().toDateString()`, `'soon'` otherwise, `'none'`
  when undefined. Update the two pages to pass BOTH the ISO (`first.start`) and the label through
  to `DoctorCard` — simplest shape: `nextAvailable: { iso: string; label: string }` in the
  `Record<string, …>` maps and in `DoctorCard`/`DoctorBrowser` props. Card renders `label`, computes
  tone from `iso`.
- **C.3 (efficiency)** Landing `/` does 1+3 uncached OpenEMR calls per request. **Defer** — this is
  PERFORMANCE_PLAN Phase 1/2 territory (caching + bulk slots). Do NOT fix here; just confirm it's
  tracked there.

**Acceptance:** `tsc` clean; `/doctors` and `/` still show next-available labels and correct dot
colors (green only for today-slots); `/code-review` low clean; commit.

---

## Phase D — typeset + layout, product mode  ▶ SONNET 5 — ✅ DONE (commit `e5a651b`)

Read `app/DESIGN.md` + `app/PRODUCT.md` first. Product register: clarity/density, zero decoration.
One pass over `/ops/*` and `/doctor/*` checking ONLY these (do not restyle):

- **D.1 typeset**: every table numeric column and stat value has `tabular-nums`; label text is
  11px-uppercase-tracking-wide ONLY for eyebrow/labels (not body); no font weight above 600.
- **D.2 layout**: section gaps are `space-y-6`; card paddings are p-5/p-6 (flag strays); table
  row height consistent (`h-11` headers, `p-4` cells per `ui/table.tsx`); PageHeader used on every
  page (no ad-hoc h1s).
- **D.3 distill** (flag-only, fix if one-liners): dead props, unused imports, copy that restates
  the obvious ("Click a slot to create" style tautologies are fine to keep if informative).

**Acceptance:** diff is small (this is a conformance pass, not a redesign); before/after screenshot
of `/ops` and `/doctor/schedule` at 1280px and 375px; `tsc` clean; `/code-review` low; commit.

---

## Phase E — polish + one delight, brand mode  ▶ SONNET 5

Read both docs first. Brand register, but calm-clinical (see PRODUCT.md anti-references).

- **E.1 polish**: landing + `/doctors` + `/book` — consistent hero glow usage, chip/pill sizing,
  button sizes (lg on hero CTAs only), check contrast of muted text on tinted surfaces (AA).
- **E.2 delight (exactly one)**: the booking confirmation page (`/book/confirmed`) success moment —
  e.g. a single subtle scale+fade-in on the check icon using existing motion tokens, honoring
  reduced-motion. Budget: ≤20 lines. Nothing else animated.
- **E.3 detect** re-scan (same greps) — no new slop introduced.

**Acceptance:** screenshots at 375px (hero, doctors, confirmed); reduced-motion verified (toggle in
preview or assert the CSS media query wraps the animation); `tsc`; `/code-review` low; commit.

---

## Phase F — final gate  ▶ SONNET 5

- **F.1** Full-route smoke: curl every route (list in PERFORMANCE_PLAN Phase 4.1) → all 200.
- **F.2** `/code-review` low on the combined B–E diff (`git diff <phase-A-commit>...HEAD`).
- **F.3** Update this file: mark phases done, note any deferred items.

**Acceptance:** all routes 200; review clean or findings triaged; plan updated; final commit.

---

## Standing token-rationing rules (all future UI sessions)

1. Start every UI session by reading `app/DESIGN.md` + `app/PRODUCT.md` — never re-derive.
2. One lever × one surface per request. Name the lever in the prompt ("typeset the ops tables"),
   never "make it better".
3. `/code-review` low by default; medium only on data-layer or auth changes; ultra never for UI.
4. **Sonnet 5 is the floor for this codebase** — Haiku's context window is too limited (multi-file
   diffs, DESIGN.md/PRODUCT.md, and Browser-pane tool output together exceed it; the screenshot tool
   was already visibly degrading under Haiku in Phase B). Run all phases, including grep audits and
   commits, on Sonnet 5. Reserve Opus/Fable for: changing DESIGN.md itself, new design systems, plan
   revisions — never drop below Sonnet.
5. No subagents for UI work — run inline.
6. Screenshot verification: one viewport per register (375px brand, 1280px product) unless the
   change is specifically responsive.
