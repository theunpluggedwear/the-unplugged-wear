'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { Calendar as DateRangeCalendar } from '@/components/calendar';
import { PageHeader } from '@/components/ui';
import { usePopoverAnimation } from '@/hooks/usePopoverAnimation';
import type { DateRange } from '@/hooks/useCalendarRange';

interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  initialLabel?: string;
}

export function DashboardHeader({ title, subtitle, initialLabel = 'Today' }: DashboardHeaderProps) {
  const router = useRouter();
  const [rangeLabel, setRangeLabel] = useState(initialLabel);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerAnim = usePopoverAnimation(pickerOpen, () => setPickerOpen(false));
  const isFiltered = rangeLabel !== initialLabel;

  function applyRange(range: DateRange, label: string) {
    setRangeLabel(label);
    setPickerOpen(false);
    const params = new URLSearchParams();
    if (range.start) params.set('from', range.start.toISOString().slice(0, 10));
    if (range.end) params.set('to', range.end.toISOString().slice(0, 10));
    const query = params.toString();
    router.push(query ? `/dashboard?${query}` : '/dashboard');
  }

  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      actions={
        <div className="relative">
          <button
            type="button"
            className={isFiltered ? 'home-dateFilterBtn home-dateFilterBtnActive' : 'home-dateFilterBtn'}
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerAnim.visible}
            aria-haspopup="dialog"
          >
            <Calendar size={18} />
            <span>{rangeLabel}</span>
          </button>
          {pickerAnim.visible && (
            <>
              <div
                aria-hidden="true"
                onClick={() => setPickerOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute right-0 top-full z-50 mt-2 ${
                  pickerAnim.phase === 'closing'
                    ? 'animate-[popoverOut_0.15s_ease-in]'
                    : 'animate-[popoverIn_0.18s_ease-out]'
                }`}
              >
                <DateRangeCalendar onApply={applyRange} onClose={() => setPickerOpen(false)} />
              </div>
            </>
          )}
        </div>
      }
    />
  );
}
