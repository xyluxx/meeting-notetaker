'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignOutButton } from './sign-out-button';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/meetings', label: 'Meetings' },
  { href: '/calendars', label: 'Calendars' },
  { href: '/settings', label: 'Settings' },
];

export function Sidebar({ brand, userName }: { brand: string; userName: string }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] px-3 py-5">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span className="rec-dot h-2.5 w-2.5 rounded-full" aria-hidden />
        <span className="truncate text-sm font-semibold tracking-tight">{brand}</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'rounded-lg px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-[var(--color-accent)]/12 text-[var(--color-accent)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
              ].join(' ')}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[var(--border)] pt-3">
        <div className="truncate px-3 pb-2 text-xs text-[var(--muted-foreground)]">{userName}</div>
        <SignOutButton />
      </div>
    </aside>
  );
}
