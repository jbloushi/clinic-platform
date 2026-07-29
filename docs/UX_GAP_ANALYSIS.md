# Product and UX gap analysis — 29 July 2026

This audit compares the implemented application with the product brief, the planning documents,
and the publicly reachable clinic-site surface. The live site could not be fetched from this build
environment (the upstream proxy returned HTTP 403), so its medical, legal, doctor, insurance, and
contact copy is **not** reproduced or guessed. Those items remain marked for clinic confirmation.

## Concise gap analysis

- **Broken/incomplete:** `USE_MOCK_DATA=true` throws instead of selecting a `MockProvider`; the
  public surface only has home/doctors/booking; no department, service, branch, insurance, contact,
  laboratory, or detailed administration information architecture exists; the booking UI is a
  two-step doctor/service flow rather than the required eight-step flow.
- **Weak UX:** the home page advertises generic family specialties and payment/credit claims that
  do not reflect Dr. Al Jarallah Clinic. Public navigation has no mobile menu, locale control,
  branch context, service discovery, or persistent booking action.
- **OpenEMR boundary:** patient, practitioner, appointment, and limited clinical reads are wired to
  OpenEMR, but provider facilities, procedures/results/documents breadth, normalized adapter errors,
  safe-read retries, request timeouts, and contract coverage remain incomplete. A direct MariaDB
  compatibility shim exists for practitioner administration and should be removed once an
  upgrade-safe API/module path is available.
- **Permissions:** roles are four free-form strings. The lab/admission/system-admin roles and a
  capability matrix do not exist. Ops currently admits doctors to the whole operations route group;
  individual route handlers do not consistently enforce action-specific permissions.
- **Duplication/consistency:** public chrome is embedded in the home page while portals use
  `AppShell`; status and formatted copy are English-only; catalog concepts are split between
  OpenEMR practitioners and a minimal platform `Service` table with no branch/department model.
- **Accessibility:** focus and reduced-motion foundations are good, but public navigation lacks a
  skip link and mobile disclosure; several dense controls become horizontally compressed; errors
  are not collected into summaries; no session-warning or PHI masking pattern exists.
- **Mobile/RTL:** root markup is fixed to `lang="en"`; there is no locale routing, Arabic font,
  translation catalog, logical-direction icon treatment, or RTL test. The seven-column slot strip
  is too dense on narrow phones and assumes English/US dates.

## Route/content mapping

| Retained content | New route | Source/status |
|---|---|---|
| Clinic overview | `/` | Product-approved structure; claims kept conservative |
| Departments | `/departments`, `/departments/[slug]` | Configured bilingual catalog |
| Services | `/services`, `/services/[slug]` | Configured bilingual catalog; prices require ops data |
| Doctors | `/doctors`, `/doctors/[id]` | OpenEMR provider |
| Branches | `/branches`, `/branches/[slug]` | Configured bilingual catalog; address/phone pending confirmation |
| Booking | `/book` | Existing workflow; must evolve to eight guarded steps |
| Insurance | `/insurance` | Pending confirmed payer list/policy copy |
| Contact | `/contact` | Pending confirmed phone, address, hours, and maps |
| Privacy/terms | `/privacy`, `/terms` | Must be migrated verbatim after clinic/legal review |

## Implementation checklist

- [x] Replace generic public positioning with clinic-specific medical information architecture.
- [x] Introduce one typed, bilingual, data-driven clinic catalog for departments/services/branches.
- [x] Add reusable responsive public header/footer, skip navigation, and persistent booking CTA.
- [x] Add department, service, and branch discovery/detail routes with contextual booking links.
- [ ] Validate and migrate live-site logo, doctor bios, contact, insurance, and legal copy with clinic.
- [ ] Implement locale routing, Arabic translations/font, RTL primitives, and rendering tests.
- [ ] Extend `DataProvider` with facilities/catalog mappings and implement a real `MockProvider`.
- [ ] Replace booking with the complete preference→branch→service→doctor→slot→identity→OTP→confirm flow.
- [ ] Add expiring holds, idempotency, transactional confirmation, and concurrency coverage.
- [ ] Replace role strings with server-enforced capabilities and add lab/admission/finance/admin roles.
- [ ] Build patient, reception, clinical, lab, and configuration workflows against the provider boundary.
- [ ] Add unit, integration, adapter-contract, RTL, and end-to-end suites from the quality plan.

