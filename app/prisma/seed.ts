/**
 * Platform-DB seed. Idempotent.
 *  - 4 staff accounts (reception, doctor, admin, finance)
 *  - Small services catalog
 */
import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

async function upsertStaff(row: {
  email: string;
  firstName: string;
  lastName: string;
  role: 'reception' | 'doctor' | 'admin' | 'finance';
  password: string;
}) {
  await prisma.staffUser.upsert({
    where: { email: row.email },
    update: { firstName: row.firstName, lastName: row.lastName, role: row.role, active: true },
    create: {
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      passwordHash: hashPassword(row.password),
      active: true,
    },
  });
}

async function upsertService(
  name: string,
  durationMinutes: number,
  priceMinor: number,
  opts: { showInServiceSearch?: boolean } = {},
) {
  const showInServiceSearch = opts.showInServiceSearch ?? true;
  const existing = await prisma.service.findFirst({ where: { name } });
  if (existing) {
    await prisma.service.update({
      where: { id: existing.id },
      data: { durationMinutes, priceMinor, showInServiceSearch },
    });
  } else {
    await prisma.service.create({ data: { name, durationMinutes, priceMinor, showInServiceSearch } });
  }
}

async function main() {
  const demoPassword = 'demo1234';
  await Promise.all([
    upsertStaff({ email: 'reception@clinic.local', firstName: 'Rana', lastName: 'Reception', role: 'reception', password: demoPassword }),
    upsertStaff({ email: 'doctor@clinic.local', firstName: 'Yusuf', lastName: 'Rahman', role: 'doctor', password: demoPassword }),
    upsertStaff({ email: 'admin@clinic.local', firstName: 'Amina', lastName: 'Admin', role: 'admin', password: demoPassword }),
    upsertStaff({ email: 'finance@clinic.local', firstName: 'Faisal', lastName: 'Finance', role: 'finance', password: demoPassword }),
  ]);

  await upsertService('New consultation', 20, 15000);
  await upsertService('Follow-up visit', 15, 8000);
  await upsertService('Extended consultation', 40, 25000);
  // Doctor-only: restricted to Dermatology (see seed-openemr eligibility) and
  // hidden from the /book/service search — demonstrates the doctor-only flag.
  await upsertService('Procedure (in-clinic)', 60, 40000, { showInServiceSearch: false });

  console.log('Seed complete. Demo staff password:', demoPassword);
  console.log('Emails: reception@clinic.local, doctor@clinic.local, admin@clinic.local, finance@clinic.local');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
