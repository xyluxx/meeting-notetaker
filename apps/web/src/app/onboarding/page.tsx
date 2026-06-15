import { redirect } from 'next/navigation';
import { ownerExists } from '@/lib/auth';
import { OnboardingForm } from './onboarding-form';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  // Single-owner: once the owner exists, onboarding is closed.
  if (await ownerExists()) redirect('/login');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <span className="rec-dot h-3 w-3 rounded-full" aria-hidden />
        <span className="text-sm font-medium tracking-wide text-[var(--muted-foreground)]">
          Welcome
        </span>
      </div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Make it yours</h1>
      <p className="mb-8 text-sm text-[var(--muted-foreground)]">
        Your name becomes the brand, the bot&apos;s name in meetings, and the “recording” tile.
      </p>
      <OnboardingForm />
    </main>
  );
}
