import { redirect } from 'next/navigation';
import { ownerExists } from '@/lib/auth';
import { getCurrentSession } from '@/lib/session';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (!(await ownerExists())) redirect('/onboarding');
  if (await getCurrentSession()) redirect('/');

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <span className="rec-dot h-3 w-3 rounded-full" aria-hidden />
        <span className="text-sm font-medium tracking-wide text-[var(--muted-foreground)]">
          NoteTaker
        </span>
      </div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Welcome back</h1>
      <LoginForm />
    </main>
  );
}
