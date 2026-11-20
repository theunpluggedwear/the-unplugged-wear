'use client';

import { useState } from 'react';
import { saveNavigationAction } from '@/server/content-actions';

export default function NavigationManager({ initial }: { initial: Record<string, unknown> }) {
  const [text, setText] = useState(JSON.stringify(initial, null, 2));
  const [notice, setNotice] = useState<string | null>(null);

  async function save() {
    setNotice(null);
    try {
      const navbar = JSON.parse(text);
      const res = await saveNavigationAction({ navbar });
      if (!res.ok) { setNotice(res.error.message); return; }
      const storefrontNote = res.data.storefront.ok ? '' : ` Storefront refresh failed: ${res.data.storefront.reason}`;
      setNotice(`Navigation saved.${storefrontNote}`);
    } catch {
      setNotice('Navigation must be valid JSON.');
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Navigation</h1>
      <textarea className="w-full border rounded px-2 py-2 font-mono text-xs" rows={20} value={text} onChange={(e) => setText(e.target.value)} />
      <button className="px-4 py-2 rounded bg-black text-white" onClick={save}>Save navigation</button>
      {notice && <p className="text-sm">{notice}</p>}
    </div>
  );
}
