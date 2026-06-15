import { redirect } from 'next/navigation';
import { ownerExists } from '@/lib/auth';
import { getCurrentSession } from '@/lib/session';
import { getSettings, resolveBrand } from '@/lib/settings';
import { Sidebar } from '@/components/sidebar';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await ownerExists())) redirect('/onboarding');
  const session = await getCurrentSession();
  if (!session?.user) redirect('/login');

  const settings = await getSettings(session.user.id);
  const brand = resolveBrand(settings);
  const accent = String(settings['identity.accent'] ?? '#6366F1');
  const dark = settings['identity.theme'] === 'dark';

  return (
    <div
      className={dark ? 'dark' : undefined}
      style={{ '--color-accent': accent } as React.CSSProperties}
    >
      <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <Sidebar brand={brand} userName={session.user.name ?? session.user.email} />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
