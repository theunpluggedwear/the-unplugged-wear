'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search as SearchIcon, Tag, X } from 'lucide-react';

const SUGGESTED = ['Hoodies', 'Sweatshirt', 'Oversized Tee', 'Acid Wash', 'Joggers', 'Mug'];

// The query lives in the URL, so results are server-rendered and shareable.
export default function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last query we pushed to the URL. An effect run that only echoes our own
  // navigation must not overwrite keystrokes typed during the debounce window.
  const committedQuery = useRef(urlQuery);

  useEffect(() => {
    if (urlQuery === committedQuery.current) return;
    // A real external URL change (back/forward, another link) wins over a pending debounce.
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    committedQuery.current = urlQuery;
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const go = (q: string) => {
    const trimmed = q.trim();
    committedQuery.current = trimmed;
    router.replace(trimmed ? `${pathname}?q=${encodeURIComponent(trimmed)}` : pathname, { scroll: false });
  };
  const change = (q: string, delay = 350) => {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      go(q);
    }, delay);
  };

  return (
    <>
      <form role="search" className="relative mt-6" onSubmit={(e) => { e.preventDefault(); change(query, 0); }}>
        <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8A8A]" aria-hidden="true" />
        <input
          type="search"
          aria-label="Search the catalog"
          placeholder="Search by keywords (e.g. hoodie, oversized tee, acid wash)..."
          value={query}
          onChange={(e) => change(e.target.value)}
          className="w-full h-14 pl-12 pr-12 rounded-2xl border border-[#E2DDCF] bg-white text-base outline-none shadow-xs focus:border-[#1A1A1A] transition-colors"
        />
        {query && (
          <button type="button" onClick={() => change('', 0)} aria-label="Clear search query" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-store-charcoal">
            <X size={18} />
          </button>
        )}
      </form>
      <div className="flex items-center gap-2 flex-wrap mt-4">
        <span className="text-xs text-[#8A8A8A] font-medium flex items-center gap-1"><Tag size={12} /> Popular:</span>
        {SUGGESTED.map((term) => (
          <button key={term} type="button" onClick={() => change(term, 0)} className="px-3 py-1 rounded-full bg-[#F4F1EA] text-xs font-medium text-store-charcoal hover:bg-[#EAE5D9] transition-colors cursor-pointer">
            {term}
          </button>
        ))}
      </div>
    </>
  );
}
