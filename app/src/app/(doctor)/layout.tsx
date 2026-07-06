import { AppShell } from '@/components/domain/app-shell';
import { requireStaff } from '@/lib/auth/guards';

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff(['doctor', 'admin']);
  return (
    <AppShell
      variant="doctor"
      user={{
        name: `Dr. ${staff.firstName} ${staff.lastName}`,
        subtitle: staff.email,
      }}
    >
      {children}
    </AppShell>
  );
}
