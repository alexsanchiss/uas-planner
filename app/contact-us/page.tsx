'use client';

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useI18n } from '../i18n/I18nContext';

const CATEGORIES = [
  'Bug Report',
  'Feature Request',
  'Account Issue',
  'Flight Plan Issue',
  'General Inquiry',
] as const;

export default function ContactUsPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const { t } = useI18n();

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[4]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subject, category, description }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || data.error || 'Failed to submit ticket');
        return;
      }

      setTicketNumber(data.ticketNumber);
      toast.success(`Ticket ${data.ticketNumber} submitted successfully`);
      setSubject('');
      setCategory(CATEGORIES[4]);
      setDescription('');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-4 text-[var(--color-primary)]">
        {t.contactPage.title}
      </h1>
      <p className="mb-6 text-[var(--text-secondary)]">
        {t.contactPage.subtitle}{' '}
        <a
          href="mailto:UPPS@sna-upv.com"
          className="text-[var(--color-primary)] hover:underline"
        >
          UPPS@sna-upv.com
        </a>
      </p>

      {ticketNumber && (
        <div className="mb-6 p-4 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400">
          <p className="font-semibold">{t.contactPage.ticketSuccess}</p>
          <p className="text-sm mt-1">
            {t.contactPage.ticketNumber}{' '}
            <span className="font-mono font-bold">{ticketNumber}</span>.{' '}
            {t.contactPage.confirmationSent}
          </p>
          <button
            onClick={() => setTicketNumber(null)}
            className="mt-3 text-sm underline hover:no-underline"
          >
            {t.contactPage.submitAnother}
          </button>
        </div>
      )}

      {authLoading ? (
        <p className="text-[var(--text-secondary)]">{t.common.loading}</p>
      ) : !user ? (
        <div className="p-6 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-center">
          <p className="text-[var(--text-secondary)] mb-4">
            {t.contactPage.loginRequired}
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-2 rounded-lg bg-[var(--color-primary)] text-white font-semibold hover:opacity-90 transition-opacity"
          >
            {t.auth.login}
          </a>
        </div>
      ) : !ticketNumber ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-6 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)]"
        >
          <div>
            <label
              htmlFor="subject"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              {t.contactPage.subject} <span className="text-red-400">*</span>
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={200}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder={t.contactPage.subjectPlaceholder}
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              {t.contactPage.category} <span className="text-red-400">*</span>
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              {t.contactPage.description} <span className="text-red-400">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
              maxLength={5000}
              rows={6}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-vertical"
              placeholder={t.contactPage.descriptionPlaceholder}
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {description.length}/5000 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || !subject.trim() || description.length < 10}
            className="w-full py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t.contactPage.submitting : t.contactPage.submit}
          </button>
        </form>
      ) : null}

      <p className="mt-8 text-sm text-[var(--text-secondary)]">
        {t.contactPage.demoNote}
      </p>
    </main>
  );
}
