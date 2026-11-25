'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Input, { type InputProps } from '@storefront/components/ui/Input';

// Building blocks shared by the profile cards: a card frame with an optional
// header action, read-only detail rows, an inline result message and a
// password field with show/hide.

export type Note = { tone: 'error' | 'ok'; text: string; link?: string } | null;

/** Indian mobile, same rule as the server (spaces/dashes ignored, optional +91). */
export const isIndianMobile = (value: string) => /^(\+91)?[6-9][0-9]{9}$/.test(value.replace(/[\s-]/g, ''));

export function ProfileCard({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border border-store-card-border bg-store-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-store-card-border">
        <div className="min-w-0">
          <h2 id={id} className="font-heading text-lg font-medium text-store-charcoal">
            {title}
          </h2>
          {description && <p className="text-sm text-store-text-secondary mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <div className="px-5 sm:px-6 py-5">{children}</div>
    </section>
  );
}

/** Label/value pairs: side by side from tablet up, stacked on phones. */
export function DetailList({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-store-card-border -my-3">{children}</dl>;
}

export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6 sm:items-baseline">
      <dt className="text-xs uppercase tracking-wider text-store-text-secondary">{label}</dt>
      <dd className="text-sm text-store-charcoal min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Result of an action, shown next to the control that caused it. */
export function InlineNote({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p
      role={note.tone === 'error' ? 'alert' : 'status'}
      className={`text-sm ${note.tone === 'error' ? 'text-store-terracotta' : 'text-store-success'}`}
    >
      {note.text}
      {note.link && (
        <>
          {' '}
          <a href={note.link} className="underline underline-offset-4 break-all text-store-charcoal">
            {note.link}
          </a>
        </>
      )}
    </p>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordInput(props: Omit<InputProps, 'type' | 'suffix'>) {
  const [shown, setShown] = useState(false);
  return (
    <Input
      {...props}
      type={shown ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? `Hide ${props.label?.toLowerCase() ?? 'password'}` : `Show ${props.label?.toLowerCase() ?? 'password'}`}
          aria-pressed={shown}
          className="inline-flex items-center justify-center w-7 h-7 -mr-1 rounded-full text-store-text-secondary hover:text-store-charcoal cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
        >
          {shown ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      }
    />
  );
}
