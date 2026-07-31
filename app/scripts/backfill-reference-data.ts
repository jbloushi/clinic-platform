/**
 * Move clinic reference data out of hardcoded TypeScript and into the platform DB.
 *
 * Before this ran, the app carried three catalogues that shared no keys: the
 * bilingual marketing constants in `src/lib/clinic-catalog.ts`, the free-text
 * specialties on OpenEMR practitioners, and the `Service` rows that bookings
 * actually reference. Mock mode hid the split because service ids happened to
 * equal slugs there; against a real OpenEMR, department filters returned
 * nothing and branch was decorative.
 *
 * This script is the merge. It reads the constants deliberately — it must run
 * BEFORE `clinic-catalog.ts` is deleted — and is idempotent, so a second run is
 * a no-op and it can be re-run after editing the mappings below.
 *
 * Run:  npm run backfill:reference
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * The seed content, copied verbatim from the `src/lib/clinic-catalog.ts` this
 * migration replaced.
 *
 * Inlined rather than imported because that module no longer exists — the whole
 * point of the change. Keeping the values here means a fresh environment can be
 * brought to the same starting state without resurrecting the file, and the
 * script stays the record of where this content came from. Ops edits these in
 * /ops/departments and /ops/branches afterwards; re-running never overwrites
 * their publishing decisions.
 */
const departments = [
  {
    slug: 'bariatric-surgery',
    name: { en: 'Obesity & bariatric surgery', ar: 'السمنة وجراحة السمنة' },
    summary: {
      en: 'Assessment and surgical care for obesity, with coordinated follow-up.',
      ar: 'تقييم ورعاية جراحية للسمنة مع متابعة متكاملة.',
    },
  },
  {
    slug: 'gastroenterology',
    name: { en: 'Gastroenterology, endoscopy & liver', ar: 'الجهاز الهضمي والمناظير والكبد' },
    summary: {
      en: 'Specialist assessment for digestive, endoscopy, and liver concerns.',
      ar: 'تقييم متخصص لأمراض الجهاز الهضمي والمناظير والكبد.',
    },
  },
  {
    slug: 'nutrition',
    name: { en: 'Clinical nutrition', ar: 'التغذية العلاجية' },
    summary: {
      en: 'Evidence-based nutrition plans supporting treatment and long-term health.',
      ar: 'خطط تغذية علاجية مبنية على الدليل لدعم العلاج والصحة طويلة المدى.',
    },
  },
  {
    slug: 'plastic-surgery',
    name: { en: 'Plastic & reconstructive surgery', ar: 'جراحة التجميل والترميم' },
    summary: {
      en: 'Specialist surgical consultation with clear, clinically appropriate guidance.',
      ar: 'استشارة جراحية متخصصة وإرشادات طبية واضحة ومناسبة.',
    },
  },
  {
    slug: 'general-surgery',
    name: { en: 'General & specialist surgery', ar: 'الجراحة العامة والتخصصية' },
    summary: {
      en: 'Consultation, diagnosis, and planned surgical care across specialist pathways.',
      ar: 'الاستشارة والتشخيص والرعاية الجراحية المخططة ضمن مسارات تخصصية.',
    },
  },
];

const catalogServices = [
  {
    slug: 'bariatric-consultation',
    departmentSlug: 'bariatric-surgery',
    name: { en: 'Bariatric surgery consultation', ar: 'استشارة جراحة السمنة' },
    summary: {
      en: 'A specialist assessment of symptoms, history, and suitable treatment pathways.',
      ar: 'تقييم متخصص للأعراض والتاريخ الصحي والمسارات العلاجية المناسبة.',
    },
    durationMinutes: 30,
  },
  {
    slug: 'gastroenterology-consultation',
    departmentSlug: 'gastroenterology',
    name: { en: 'Gastroenterology consultation', ar: 'استشارة الجهاز الهضمي' },
    summary: {
      en: 'Assessment of digestive or liver symptoms and the appropriate next steps.',
      ar: 'تقييم أعراض الجهاز الهضمي أو الكبد وتحديد الخطوات المناسبة.',
    },
    durationMinutes: 30,
  },
  {
    slug: 'nutrition-consultation',
    departmentSlug: 'nutrition',
    name: { en: 'Clinical nutrition consultation', ar: 'استشارة تغذية علاجية' },
    summary: {
      en: 'Personalised nutrition assessment aligned with your clinical care plan.',
      ar: 'تقييم تغذوي شخصي متوافق مع خطتك العلاجية.',
    },
    durationMinutes: 30,
  },
  {
    slug: 'surgical-consultation',
    departmentSlug: 'general-surgery',
    name: { en: 'General surgery consultation', ar: 'استشارة الجراحة العامة' },
    summary: {
      en: 'Review of a surgical concern, options, and recommended follow-up.',
      ar: 'مراجعة الحالة الجراحية والخيارات والمتابعة الموصى بها.',
    },
    durationMinutes: 30,
  },
];

const branches = [
  {
    slug: 'hawally',
    name: { en: 'Hawally branch', ar: 'فرع حولي' },
    area: { en: 'Hawally, Kuwait', ar: 'حولي، الكويت' },
  },
  {
    slug: 'jahra',
    name: { en: 'Jahra branch', ar: 'فرع الجهراء' },
    area: { en: 'Jahra, Kuwait', ar: 'الجهراء، الكويت' },
  },
];

/**
 * Department -> the OpenEMR `users.specialty` strings that belong to it.
 *
 * Deliberately generous, and covering two vocabularies at once: the strings the
 * mock provider uses (which mirror the department names) and the generic ones
 * the OpenEMR seed writes (Internal Medicine, Cardiology…). A department with no
 * matching doctors renders as an empty list, so over-mapping during the cutover
 * is much cheaper than under-mapping. Ops can prune this in /ops/departments.
 */
const DEPARTMENT_SPECIALTIES: Record<string, string[]> = {
  'bariatric-surgery': [
    'Obesity & bariatric surgery',
    'Bariatric Surgery',
    'Obesity Medicine',
  ],
  gastroenterology: [
    'Gastroenterology, endoscopy & liver',
    'Gastroenterology',
    'Hepatology',
    'Internal Medicine',
  ],
  nutrition: ['Clinical nutrition', 'Clinical Nutrition', 'Dietetics'],
  'plastic-surgery': ['Plastic & reconstructive surgery', 'Plastic Surgery', 'Dermatology'],
  'general-surgery': [
    'General & specialist surgery',
    'General Surgery',
    'Orthopedics',
    'ENT',
    'Family Medicine',
  ],
};

/** Prices for the four public services, in fils. Previously hardcoded to 2500. */
const CATALOG_SERVICE_PRICE_MINOR: Record<string, number> = {
  'bariatric-consultation': 3000,
  'gastroenterology-consultation': 2500,
  'nutrition-consultation': 1800,
  'surgical-consultation': 2500,
};

function specialtyKey(value: string): string {
  return value.trim().toLowerCase();
}

async function backfillDepartments() {
  console.log('· departments…');
  for (const [index, department] of departments.entries()) {
    const row = await prisma.department.upsert({
      where: { slug: department.slug },
      // Update only presentation fields — never `published`, so a re-run
      // doesn't un-hide a department ops deliberately took down.
      update: {
        nameEn: department.name.en,
        nameAr: department.name.ar,
        summaryEn: department.summary.en,
        summaryAr: department.summary.ar,
      },
      create: {
        slug: department.slug,
        nameEn: department.name.en,
        nameAr: department.name.ar,
        summaryEn: department.summary.en,
        summaryAr: department.summary.ar,
        published: true,
        sortOrder: index,
      },
    });

    for (const specialty of DEPARTMENT_SPECIALTIES[department.slug] ?? []) {
      const key = specialtyKey(specialty);
      await prisma.departmentSpecialty.upsert({
        where: { departmentId_specialtyKey: { departmentId: row.id, specialtyKey: key } },
        update: { specialty },
        create: { departmentId: row.id, specialty, specialtyKey: key },
      });
    }
  }
}

/**
 * Branches, linked to an OpenEMR facility by name where one matches.
 *
 * Matching on name is a convenience for the initial import only — after this,
 * the link is ops-managed in /ops/branches. A branch that finds no facility
 * stays unlinked and unpublished rather than guessing, because a wrong link
 * would file appointments at the wrong clinic.
 */
async function backfillBranches(facilities: { id: string; name: string }[]) {
  console.log('· branches…');
  const byName = new Map(facilities.map((f) => [f.name.trim().toLowerCase(), f.id]));

  for (const [index, branch] of branches.entries()) {
    const existing = await prisma.branch.findUnique({ where: { slug: branch.slug } });

    // Never re-point an existing link: ops may have corrected it deliberately.
    let facilityId = existing?.openemrFacilityId ?? null;
    if (facilityId == null) {
      const matched = byName.get(branch.name.en.trim().toLowerCase());
      if (matched != null) {
        const claimed = await prisma.branch.findUnique({
          where: { openemrFacilityId: Number(matched) },
        });
        if (!claimed) facilityId = Number(matched);
      }
    }

    await prisma.branch.upsert({
      where: { slug: branch.slug },
      update: {
        nameEn: branch.name.en,
        nameAr: branch.name.ar,
        areaEn: branch.area.en,
        areaAr: branch.area.ar,
        ...(existing?.openemrFacilityId == null && facilityId != null
          ? { openemrFacilityId: facilityId, published: true }
          : {}),
      },
      create: {
        slug: branch.slug,
        nameEn: branch.name.en,
        nameAr: branch.name.ar,
        areaEn: branch.area.en,
        areaAr: branch.area.ar,
        openemrFacilityId: facilityId,
        // A branch is only real once it points at a facility.
        published: facilityId != null,
        sortOrder: index,
      },
    });

    console.log(
      `  ${branch.slug.padEnd(10)} ${facilityId != null ? `→ facility #${facilityId}` : '(unlinked — link it in /ops/branches)'}`,
    );
  }
}

/**
 * The merge itself: the four marketing services become real, bookable `Service`
 * rows, keyed by the slug the public pages and search index already link to.
 */
async function mergeCatalogServices() {
  console.log('· merging public catalogue into Service…');
  for (const [index, service] of catalogServices.entries()) {
    const department = await prisma.department.findUnique({
      where: { slug: service.departmentSlug },
      select: { id: true },
    });

    await prisma.service.upsert({
      where: { slug: service.slug },
      // A re-run refreshes copy but leaves price, duration and the publishing
      // flags alone — those are ops decisions once the row exists.
      update: {
        name: service.name.en,
        nameAr: service.name.ar,
        summaryEn: service.summary.en,
        summaryAr: service.summary.ar,
        departmentId: department?.id ?? null,
      },
      create: {
        slug: service.slug,
        name: service.name.en,
        nameAr: service.name.ar,
        summaryEn: service.summary.en,
        summaryAr: service.summary.ar,
        departmentId: department?.id ?? null,
        durationMinutes: service.durationMinutes ?? 30,
        priceMinor: CATALOG_SERVICE_PRICE_MINOR[service.slug] ?? 2500,
        currency: 'KWD',
        active: true,
        showInServiceSearch: true,
        publishedOnWeb: true,
        sortOrder: index,
      },
    });
  }
}

async function main() {
  console.log('Backfilling reference data…');

  // Read the clinic locations OpenEMR already knows about, so branches can be
  // linked without a separate manual step. Failing to reach it is not fatal —
  // branches are created unlinked and ops can link them later.
  const { getDataProvider } = await import('../src/lib/data');
  const facilities = await getDataProvider()
    .getFacilities()
    .catch(() => {
      console.warn('  (could not read OpenEMR facilities — branches will be left unlinked)');
      return [] as { id: string; name: string }[];
    });

  await backfillDepartments();
  await backfillBranches(facilities);
  await mergeCatalogServices();

  const [departmentCount, specialtyCount, branchCount, serviceCount] = await Promise.all([
    prisma.department.count(),
    prisma.departmentSpecialty.count(),
    prisma.branch.count(),
    prisma.service.count(),
  ]);

  console.log('\nDone.');
  console.log(`  departments:  ${departmentCount} (${specialtyCount} specialty mappings)`);
  console.log(`  branches:     ${branchCount}`);
  console.log(`  services:     ${serviceCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
