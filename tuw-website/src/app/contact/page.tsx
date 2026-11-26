'use client';

import React, { useEffect, useReducer, useState } from 'react';
import { useSiteSettings } from '@storefront/lib/site-settings';
import Link from 'next/link';
import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';
import Breadcrumb from '@storefront/components/ui/Breadcrumb';
import Input from '@storefront/components/ui/Input';
import Select from '@storefront/components/ui/Select';
import Textarea from '@storefront/components/ui/Textarea';
import { myOrdersAction } from '@/server/order-actions';
import type { OrderView } from '@tuw/heart/modules/orders';
import { useSession } from '@storefront/lib/session';
import { site } from '@storefront/lib/site';
import { asyncReducer, initialAsync } from '@storefront/lib/async-state';
import { ArrowRight, Check, Clock, Info, Mail, MapPin } from 'lucide-react';


const TOPICS = [
  { value: 'order', label: 'An order' },
  { value: 'sizing', label: 'Size & fit' },
  { value: 'returns', label: 'Returns & exchanges' },
  { value: 'product', label: 'A product' },
  { value: 'other', label: 'Something else' },
] as const;
type Topic = (typeof TOPICS)[number]['value'];

// Self-serve answers shown before the form, so most questions never need a message.
const QUICK_HELP = [
  { href: '/track-order', label: 'Track an order', body: 'See where your order is' },
  { href: '/policies/returns', label: 'Returns', body: '7 days on unworn clothing' },
  { href: '/size-guide', label: 'Size guide', body: 'Measurements for every fit' },
  { href: '/faq', label: 'FAQ', body: 'Printing, delivery and more' },
];

const SOCIAL = [
  { label: 'Instagram', href: site.social.instagram },
  { label: 'Facebook', href: site.social.facebook },
  { label: 'Pinterest', href: site.social.pinterest },
  { label: 'X', href: site.social.x },
].filter((s) => s.href);

export default function ContactPage() {
  const { session } = useSession();
  const { supportEmail: SUPPORT_EMAIL } = useSiteSettings();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [topic, setTopic] = useState<Topic>('order');
  const [message, setMessage] = useState('');
  const [request, dispatchRequest] = useReducer(asyncReducer<string | null>, initialAsync);
  const submitted = request.kind === 'success';
  const submitError = request.kind === 'error' ? request.message : null;
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Signed-in shoppers don't retype their details (only fills empty fields).
  useEffect(() => {
    if (!session) return;
    setName((n) => n || session.name);
    setEmail((e) => e || session.email);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let live = true;
    setOrdersLoading(true);
    void myOrdersAction({})
      .then((result) => { if (live && result.ok) setOrders(result.data); })
      .finally(() => { if (live) setOrdersLoading(false); });
    return () => { live = false; };
  }, [session]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Please add your name';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Please enter a valid email address';
    if ((topic === 'order' || topic === 'returns') && !orderRef.trim()) {
      errs.orderRef = 'Please choose or enter your order number';
    }
    if (message.trim().length < 10) errs.message = 'Please tell us a little more (at least 10 characters)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    dispatchRequest({ type: 'START' });
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          name,
          email,
          subject: TOPICS.find((entry) => entry.value === topic)?.label ?? 'General inquiry',
          message,
          orderRef,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        dispatchRequest({ type: 'FAIL', message: result.error ?? 'Could not save your message. Please try again.' });
        return;
      }
      dispatchRequest({ type: 'SUCCESS', data: null });
    } catch {
      dispatchRequest({ type: 'FAIL', message: 'Could not save your message. Please try again.' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-store-canvas text-store-charcoal">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Contact' }]} />

        <header className="mt-8 mb-10 max-w-2xl">
          <h1 className="tuw-h1 text-store-charcoal">
            Get in touch
          </h1>
          <p className="mt-3 text-base sm:text-lg text-store-text-secondary leading-relaxed">
            Questions about an order, sizing or a piece you have your eye on? Write to us — we read every message and
            reply within one business day.
          </p>
        </header>

        {/* Quick answers */}
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {QUICK_HELP.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group h-full flex items-start justify-between gap-3 p-4 sm:p-5 bg-store-surface border border-store-card-border hover:border-store-charcoal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
              >
                <span>
                  <span className="block text-sm font-medium text-store-charcoal">{item.label}</span>
                  <span className="block mt-1 text-xs text-store-text-secondary">{item.body}</span>
                </span>
                <ArrowRight size={14} aria-hidden="true" className="mt-0.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
          {/* Form */}
          <section aria-labelledby="form-heading" className="bg-store-surface border border-store-card-border p-6 sm:p-8">
            {submitted ? (
              <div className="py-10 text-center space-y-4" role="status">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-store-charcoal text-white">
                  <Check size={22} aria-hidden="true" />
                </span>
                <h2 className="font-heading text-2xl font-medium text-store-charcoal">Thanks, {name.split(' ')[0]}</h2>
                <p className="text-sm text-store-text-secondary max-w-md mx-auto leading-relaxed">
                  Your message is in our support inbox. Our team can reply to <strong className="font-medium text-store-charcoal">{email}</strong> there.
                </p>
                <p className="text-xs text-store-text-secondary">No automated reply or email is sent from this form.</p>
                <button
                  type="button"
                  onClick={() => {
                    dispatchRequest({ type: 'RESET' });
                    setMessage('');
                    setOrderRef('');
                  }}
                  className="mt-2 inline-flex items-center h-11 px-6 rounded-full border border-store-charcoal text-sm font-medium text-store-charcoal hover:bg-store-charcoal hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <h2 id="form-heading" className="font-heading text-xl font-medium text-store-charcoal">
                  Send us a message
                </h2>

                <fieldset>
                  <legend className="text-sm font-medium text-store-charcoal mb-2">What’s it about?</legend>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        aria-pressed={topic === t.value}
                        onClick={() => setTopic(t.value)}
                        className={`px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold ${
                          topic === t.value
                            ? 'bg-store-charcoal text-white'
                            : 'border border-store-border text-store-text-secondary hover:border-store-charcoal hover:text-store-charcoal'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" required />
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={errors.email}
                    autoComplete="email"
                    required
                  />
                </div>

                {(topic === 'order' || topic === 'returns') && (
                  <div className="space-y-1.5">
                    {session && orders.length > 0 ? (
                      <Select
                        label="Your order"
                        value={orderRef}
                        onChange={setOrderRef}
                        error={errors.orderRef}
                        helperText="Choose the order your message is about."
                        required
                        options={[
                          { value: '', label: 'Select an order' },
                          ...orders.map((order) => ({
                            value: order.orderNumber,
                            label: `${order.orderNumber} · ${new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${order.status}`,
                          })),
                        ]}
                      />
                    ) : (
                      <Input
                        label="Order number"
                        placeholder="e.g. TUW-9042"
                        value={orderRef}
                        onChange={(e) => setOrderRef(e.target.value.toUpperCase())}
                        error={errors.orderRef}
                        required
                      />
                    )}
                    {ordersLoading ? <p className="text-xs text-store-text-secondary">Loading your orders…</p> : null}
                    {session && !ordersLoading && orders.length === 0 ? (
                      <p className="text-xs text-store-text-secondary">You have no orders yet — enter your order number above.</p>
                    ) : null}
                  </div>
                )}

                <Textarea
                  label="Message"
                  placeholder="Tell us how we can help."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  error={errors.message}
                  rows={5}
                  required
                />

                {submitError ? (
                  <p role="alert" className="text-sm text-[#EF4444] font-medium">{submitError}</p>
                ) : null}

                <p className="flex items-start gap-2 text-xs text-store-text-secondary">
                  <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                  Saved to our support inbox — no automated reply or email is sent.
                </p>

                <button
                  type="submit"
                  disabled={request.kind === 'loading'}
                  className="w-full h-12 rounded-full bg-[#111111] text-white text-sm font-medium hover:bg-black transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold focus-visible:ring-offset-2"
                >
                  {request.kind === 'loading' ? 'Sending…' : 'Send message'}
                </button>
              </form>
            )}
          </section>

          {/* Details */}
          <aside className="space-y-6">
            <section aria-labelledby="details-heading" className="p-6 sm:p-8 bg-store-cream border border-store-card-border">
              <h2 id="details-heading" className="font-heading text-xl font-medium text-store-charcoal">Other ways to reach us</h2>
              <ul className="mt-5 space-y-5 text-sm">
                <li className="flex items-start gap-3">
                  <Mail size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block font-medium text-store-charcoal">Email</span>
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-store-text-secondary underline underline-offset-4 decoration-store-gold hover:text-store-charcoal">
                      {SUPPORT_EMAIL}
                    </a>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block font-medium text-store-charcoal">Reply time</span>
                    <span className="text-store-text-secondary">Within one business day, Monday – Saturday</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block font-medium text-store-charcoal">Based in</span>
                    <span className="text-store-text-secondary">Surat, Gujarat, India · online only, no walk-in store</span>
                  </span>
                </li>
              </ul>
              {SOCIAL.length > 0 && (
                <div className="mt-6 pt-5 border-t border-store-card-border">
                  <p className="text-sm font-medium text-store-charcoal">Follow along</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {SOCIAL.map((s) => (
                      <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="text-store-text-secondary underline underline-offset-4 decoration-store-gold hover:text-store-charcoal">
                        {s.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <p className="text-sm text-store-text-secondary leading-relaxed px-1">
              Every message is read and answered by a person — no bots, no auto-replies.
            </p>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
