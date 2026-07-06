import { redirect } from 'next/navigation';
import { getSession, type SessionData } from './session';

type Role = NonNullable<SessionData['staff']>['role'];

export async function requireStaff(roles?: Role[]) {
  const s = await getSession();
  if (!s.staff) redirect('/staff/login');
  if (roles && !roles.includes(s.staff.role)) redirect('/staff/login?forbidden=1');
  return s.staff;
}

export async function requirePatient() {
  const s = await getSession();
  if (!s.patient) redirect('/login');
  return s.patient;
}

export async function currentUser() {
  const s = await getSession();
  return { staff: s.staff, patient: s.patient };
}
