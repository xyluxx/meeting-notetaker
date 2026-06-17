'use client';

import { useState } from 'react';
import { setActionItemDone } from '../actions';

export interface ActionItemView {
  id: string;
  text: string;
  done: boolean;
  assignee: string | null;
}

export function ActionItems({ items }: { items: ActionItemView[] }) {
  const [state, setState] = useState(items);

  async function toggle(id: string, done: boolean) {
    setState((prev) => prev.map((i) => (i.id === id ? { ...i, done } : i))); // optimistic
    const res = await setActionItemDone(id, done);
    if (!res.ok) setState((prev) => prev.map((i) => (i.id === id ? { ...i, done: !done } : i)));
  }

  if (state.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No action items.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {state.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={item.done}
            onChange={(e) => toggle(item.id, e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-accent)]"
          />
          <span className={item.done ? 'text-[var(--muted-foreground)] line-through' : ''}>
            {item.text}
            {item.assignee && (
              <span className="ml-2 rounded bg-[var(--muted)] px-1.5 py-0.5 text-xs text-[var(--muted-foreground)]">
                @{item.assignee}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
