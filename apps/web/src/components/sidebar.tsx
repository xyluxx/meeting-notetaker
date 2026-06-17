'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SignOutButton } from './sign-out-button';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/meetings', label: 'Meetings' },
  { href: '/calendars', label: 'Calendars' },
  { href: '/settings', label: 'Settings' },
];

export function Sidebar({ brand, userName }: { brand: string; userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever navigation occurs.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const nav = (
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
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 md:hidden">
        <span className="flex items-center gap-2 truncate text-sm font-semibold tracking-tight">
          <span className="rec-dot h-2.5 w-2.5 rounded-full" aria-hidden />
          {brand}
        </span>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 hover:bg-[var(--muted)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 6h18M3 12h18M3 18h18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Overlay (mobile only, when open) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={[
          'fixed left-0 top-0 z-50 flex h-screen w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] px-3 py-5 transition-transform',
          'md:sticky md:z-auto md:translate-x-0 md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <span className="flex items-center gap-2.5 truncate">
            <span className="rec-dot h-2.5 w-2.5 rounded-full" aria-hidden />
            <span className="truncate text-sm font-semibold tracking-tight">{brand}</span>
          </span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 hover:bg-[var(--muted)] md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {nav}

        <div className="mt-auto border-t border-[var(--border)] pt-3">
          <div className="truncate px-3 pb-2 text-xs text-[var(--muted-foreground)]">
            {userName}
          </div>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
