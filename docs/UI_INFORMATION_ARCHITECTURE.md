# UI Information Architecture

Three portals, one design system. Route groups: `/(patient)` public+patient, `/(ops)` clinic staff,
`/(doctor)` doctors. Phase tags: **P1** = mock-mode demo (build now), **P2** = OpenEMR integration,
**P3** = future. "Data" names `DataProvider` repository functions (see
[poc/data-provider.interface.ts](../poc/data-provider.interface.ts)).

## Visual Direction

Clean, calm, professional medical SaaS (Linear / Stripe Dashboard / Apple Health). White background,
soft blue accent (`#2563EB`-family), navy for headers/sidebar text, light-gray surfaces, subtle 1px
borders, generous spacing, cards + clear tables + status badges. Inter (or Geist) typography.
English-first; RTL-ready (logical properties `ps-*/pe-*`, `dir`-aware layout). Accessible (WCAG AA
contrast, focus states, keyboard nav). **No salon/spa/luxury language anywhere — clinical and
professional.**

## A) Patient Portal `/(patient)`

| Page (route) | Purpose | User | Key components | Data | OpenEMR mapping | Phase |
|---|---|---|---|---|---|---|
| Home `/` | Clinic intro, specialties, doctor highlights, book CTA | Public | Topbar, Hero, DoctorCard grid, ServiceCard, Footer | `getPractitioners`, `getServices` | REST practitioner/facility | P1 |
| Find Doctor `/doctors` | Browse/filter doctors by specialty, day | Public | SearchInput, FilterBar, DoctorCard grid, EmptyState | `getPractitioners({specialty, day})` | REST practitioner | P1 |
| Doctor Profile `/doctors/[id]` | Bio, specialty, fees + availability calendar | Public | PageHeader, DoctorCard(lg), CalendarView(month/day), slot chips | `getPractitionerById`, `getAvailableSlots(practitionerId, dateRange)` | REST practitioner + **adapter slot computation** | P1 |
| Book `/book/[doctorId]` | Slot → patient details stepper | Public | Stepper, FormField set, slot summary card | `getAvailableSlots`, `createBooking` (held) | REST appointment create (P2) | P1 |
| Login / Register `/login` | Mobile number + OTP | Patient | FormField(phone), OTPInput, info panel | `requestOtp`, `verifyOtp` | Platform DB (identity→patient UUID) | P1 |
| Checkout `/book/checkout` | Pay consultation fee; apply wallet credit | Patient | OrderSummary, WalletBalance, PaymentMethod (mock), Modal | `getWallet`, `createPayment`, `confirmBooking` | Platform DB; REST appointment status (P2) | P1 |
| Confirmation `/book/confirmed` | Success + details + add-to-calendar | Patient | SuccessPanel, appointment card | `getAppointmentById` | — | P1 |
| My Appointments `/account/appointments` | Upcoming/past; cancel/reschedule | Patient | Tabs, DataTable/list, StatusBadge, Modal(cancel) | `getAppointments({patientId})`, `updateAppointmentStatus` | REST appointment (P2) | P1 |
| My Medical Records `/account/records` | Visit summaries, prescriptions, results (read-only) | Patient | Tabs (Visits/Prescriptions/Results/Documents), list cards, EmptyState | `getPatientMedicalHistory`, `getEncounters` | FHIR Condition/MedicationRequest/Observation/DocumentReference | P1 mock / P2 real |
| Profile `/account/profile` | Demographics, contact, wallet history | Patient | FormField set, WalletBalance + transaction DataTable | `getPatientById`, `getWallet`, `getWalletTransactions` | REST patient + platform DB | P1 |

## B) Clinic Operations Portal `/(ops)`

| Page (route) | Purpose | User | Key components | Data | OpenEMR mapping | Phase |
|---|---|---|---|---|---|---|
| Dashboard `/ops` | Today at a glance: appointments, revenue, no-shows, new patients | Reception/Admin | StatCard row, mini CalendarView(day), recent-bookings DataTable | `getDashboardStats`, `getAppointments({date:today})` | Aggregated adapter queries | P1 |
| Appointment Calendar `/ops/calendar` | Day/week grid by provider; create/move/cancel; walk-ins | Reception | CalendarView(day/week, provider columns), Modal(new/edit), StatusBadge legend | `getAppointments({range, practitionerId})`, `createAppointment`, `updateAppointmentStatus` | REST appointment CRUS | P1 |
| Patient Directory `/ops/patients` | Search/register patients | Reception | SearchInput, DataTable, Modal(register), PatientCard | `getPatients({query})`, `createPatient` | REST patient CRUS | P1 |
| Patient Profile `/ops/patients/[id]` | Demographics, appointments, invoices, wallet, documents | Reception/Admin | PageHeader, Tabs, DataTable, WalletBalance, admin-adjust Modal | `getPatientById`, `getAppointments`, `getInvoices`, `getWallet`, `adjustWallet` | REST patient + platform DB | P1 |
| Billing & Payments `/ops/billing` | Invoices, payment status, record manual payments, refunds | Finance/Reception | FilterBar, DataTable, StatusBadge, Modal(record payment) | `getInvoices`, `createPayment`, `refundPayment` | Platform DB (P1); OpenEMR billing sync P3 | P1 |
| Doctors / Providers `/ops/providers` | Provider list, profiles, weekly availability editor | Admin | DataTable, DoctorCard, AvailabilityEditor (week grid) | `getPractitioners`, `updatePractitionerAvailability` | REST practitioner; availability = pc_event categories (P2) or platform config (P1) | P1 |
| Services / Visit Types `/ops/services` | Consultation types, durations, fees | Admin | DataTable, Modal(edit), StatusBadge(active) | `getServices`, `upsertService` | Platform DB catalog (mirror to OpenEMR codes P3) | P1 |
| Reports & Analytics `/ops/reports` | Appointments, revenue, utilization trends | Admin/Finance | StatCard, charts (bar/line), date FilterBar, export | `getReport(type, range)` | Adapter aggregation | P1 lite / P3 full |
| Users & Roles `/ops/users` | Staff accounts + role assignment | Admin | DataTable, Modal(invite/edit), role StatusBadge | `getUsers`, `upsertUser` | Platform DB | P1 |
| Settings `/ops/settings` | Clinic info, hours, booking rules, payment mode, env indicator | Admin | Tabs, FormField sets, danger zone | `getSettings`, `updateSettings` | Platform DB | P1 |

## C) Doctor Portal `/(doctor)`

| Page (route) | Purpose | User | Key components | Data | OpenEMR mapping | Phase |
|---|---|---|---|---|---|---|
| Dashboard `/doctor` | Today's counts, next patient, pending follow-ups | Doctor | StatCard row, next-patient card, follow-up list | `getDoctorDashboard(practitionerId)` | Adapter aggregation | P1 |
| Today's Schedule `/doctor/schedule` | Time-ordered list; check-in status; start consult | Doctor | CalendarView(day)/timeline list, StatusBadge, "Start consult" action | `getAppointments({practitionerId, date})` | REST appointment | P1 |
| Consultation Workspace `/doctor/consult/[appointmentId]` | Single-screen consult: chart summary + note + orders | Doctor | Split layout: PatientCard + chart summary rail; note editor; orders panel; finish Modal | `getPatientMedicalHistory`, `createEncounter`, `createPrescription`, `createOrder` | FHIR reads; encounter/Rx writes **mock in P1**, module/API in P3 | P1 (writes mock) |
| Patient Medical Chart `/doctor/patients/[id]` | Full chart: problems, allergies, meds, vitals, labs, docs | Doctor | Tabs, timeline, DataTable(vitals/labs), DocumentList | `getPatientMedicalHistory`, `getEncounters` | FHIR Condition/Allergy/Medication/Observation/DocumentReference | P1 mock / P2 real |
| Encounters / Notes `/doctor/encounters` | Past encounter notes; sign/amend | Doctor | DataTable, note viewer, StatusBadge(signed/draft) | `getEncounters({practitionerId})` | REST/FHIR Encounter | P1 mock / P2 read |
| Prescriptions `/doctor/prescriptions` | Issued prescriptions; renew | Doctor | DataTable, Rx detail Modal | `getPrescriptions` | REST prescriptions (read) | P1 mock / P2 read |
| Lab Requests `/doctor/labs` | Order labs; view results | Doctor | DataTable, order Modal, result viewer | `getLabOrders`, `createOrder(lab)` | FHIR ServiceRequest/Observation (read P2); writes P3 | P1 mock |
| Imaging Requests `/doctor/imaging` | Order imaging; view reports | Doctor | DataTable, order Modal, report viewer | `getImagingOrders`, `createOrder(imaging)` | FHIR ServiceRequest/DiagnosticReport | P1 mock |
| Follow-ups `/doctor/followups` | Pending follow-ups → one-click rebook | Doctor | DataTable, quick-book Modal | `getFollowUps`, `createAppointment` | Platform DB + REST appointment | P1 |

## Design System

### Component inventory

Primitives in `components/ui/` (shadcn/ui-based, kebab-case files, PascalCase exports):
`button`, `card`, `input`, `select`, `dialog` (→Modal), `tabs`, `badge`, `table`, `form`,
`skeleton`, `toast`, `dropdown-menu`, `avatar`, `calendar`, `breadcrumbs`.

Domain components in `components/domain/` (composed, typed against domain models):

| Component | Notes |
|---|---|
| `AppShell` | Sidebar + Topbar + content slot; variant per portal (patient portal uses Topbar-only marketing shell on public pages) |
| `Sidebar` / `Topbar` / `PageHeader` / `Breadcrumbs` | Navigation chrome; PageHeader = title + actions + meta |
| `StatCard` | KPI number + delta + icon |
| `DataTable` | TanStack Table wrapper: sorting, pagination, row actions, empty/loading states built in |
| `StatusBadge` | Single source of truth for status→color: `held/pending_payment` amber, `confirmed` blue, `checked_in` teal, `completed` green, `cancelled` gray, `no_show` red |
| `CalendarView` | Month (profile availability), day/week grid with provider columns (ops), day timeline (doctor) |
| `PatientCard` / `DoctorCard` | Identity summaries (avatar, key facts, actions) |
| `FormField` | Label + control + error + hint, react-hook-form + zod wired |
| `Modal` | Confirm + form variants; destructive style for dangerous actions |
| `EmptyState` / `LoadingState` (skeletons) / `ErrorState` | Every data surface must render all three |
| `SearchInput` / `FilterBar` | Debounced search; chip filters |
| `WalletBalance` / `OTPInput` / `Stepper` / `AvailabilityEditor` | Flow-specific |

### Conventions

- Route groups `(patient)/(ops)/(doctor)` with per-group `layout.tsx` (AppShell variant + role guard).
- Domain types (Patient, Practitioner, Appointment, Slot, …) come **only** from `lib/data/types.ts` — never redefined in components.
- Design tokens in Tailwind theme + CSS variables (`--primary`, `--surface`, `--border`, status colors); no hard-coded hex in components.
- Every async page: loading skeleton, error state, empty state. No layout shift on load.
- Icons: lucide-react only. Dates: a single `formatDate`/`formatTime` util (locale-aware for future Arabic).
