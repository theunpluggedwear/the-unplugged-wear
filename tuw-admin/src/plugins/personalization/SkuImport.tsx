'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, ContentCard, Input, Select, Textarea } from '@/components/ui';
import { getProductAction, importQikinkSkuMapAction } from '@/server/catalog-actions';
import { emptySkuColumns, extractSkuRows, matchSkuRows, parseCsv, suggestSkuColumns, type SkuColumns } from './csv';
import { personalizationAdminAction } from './actions';
import type { QikinkMode } from './preview-settings';

export interface SkuImportProps {
  canManage: boolean;
  initialProductId?: string;
}

type Notice = { tone: 'ok' | 'warn' | 'error'; text: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const noticeColors: Record<Notice['tone'], { background: string; color: string }> = {
  ok: { background: 'var(--tuw-bg-success, #F3FAF6)', color: 'var(--tuw-text-success, #187343)' },
  warn: { background: 'var(--tuw-bg-warning, #FEFBF5)', color: 'var(--tuw-text-warning, #856300)' },
  error: { background: 'var(--tuw-bg-error, #FEF4F4)', color: 'var(--tuw-text-error, #C91818)' },
};

const smallText: React.CSSProperties = { fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' };

export default function SkuImport({ canManage, initialProductId = '' }: SkuImportProps) {
  const [productId, setProductId] = useState(initialProductId);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [columns, setColumns] = useState<SkuColumns>(emptySkuColumns);
  const [variants, setVariants] = useState<{ id: string; sku: string; color: string; size: string }[]>([]);
  const [productName, setProductName] = useState('');
  const [mode, setMode] = useState<QikinkMode | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void personalizationAdminAction({ op: 'load', categoryIds: [] }).then((result) => {
      if (result.ok) setMode(result.data.mode);
    });
  }, []);

  const table = useMemo(() => parseCsv(csvText), [csvText]);
  const headerKey = table.headers.join('|');
  useEffect(() => {
    setColumns(suggestSkuColumns(table));
  }, [headerKey]);

  const rows = useMemo(() => extractSkuRows(table, columns), [table, columns]);
  const matched = useMemo(() => matchSkuRows(rows, variants), [rows, variants]);

  const columnOptions = [
    { label: 'Not selected', value: '' },
    ...table.headers.map((header) => ({ label: header, value: header })),
  ];

  const loadProduct = async () => {
    if (busy) return;
    if (!uuidPattern.test(productId.trim())) {
      setNotice({ tone: 'error', text: 'Enter the product UUID from the product editor URL.' });
      return;
    }
    setBusy(true);
    const result = await getProductAction({ id: productId.trim() });
    setBusy(false);
    if (!result.ok) {
      setVariants([]);
      setProductName('');
      setNotice({ tone: 'error', text: result.error.message });
      return;
    }
    setVariants(result.data.variants.map((variant) => ({
      id: variant.id, sku: variant.sku, color: variant.color, size: variant.size,
    })));
    setProductName(result.data.name);
    setNotice({ tone: 'ok', text: `Loaded ${result.data.variants.length} variants for ${result.data.name}.` });
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setCsvText(content);
    setFileName(file.name);
    setNotice({ tone: 'ok', text: `Read ${file.name}. Check the detected columns before saving.` });
  };

  const save = async () => {
    if (busy || !canManage) return;
    if (!uuidPattern.test(productId.trim())) {
      setNotice({ tone: 'error', text: 'Enter the product UUID before importing SKUs.' });
      return;
    }
    if (!variants.length) {
      setNotice({ tone: 'error', text: `Load the product's variants first${productName ? ` (${productName})` : ''}.` });
      return;
    }
    if (!columns.storeSku) {
      setNotice({ tone: 'error', text: 'Choose the column that holds the Store SKU to save.' });
      return;
    }
    if (matched.duplicates.length) {
      setNotice({
        tone: 'error',
        text: `Duplicate Store SKUs: ${matched.duplicates.slice(0, 3).join(', ')}${matched.duplicates.length > 3 ? '…' : ''}. Fix the sheet before importing.`,
      });
      return;
    }
    if (!matched.rows.length) {
      setNotice({ tone: 'error', text: 'No rows matched a variant. Check the product and the Product SKU column.' });
      return;
    }
    setBusy(true);
    const result = await importQikinkSkuMapAction({ productId: productId.trim(), rows: matched.rows });
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error.message });
      return;
    }
    const problems = matched.unmatched.length + matched.skipped.length;
    setNotice({
      tone: problems ? 'warn' : 'ok',
      text: `Saved ${result.data.saved} of ${rows.length} rows. ${matched.unmatched.length} unmatched, ${matched.skipped.length} without a Store SKU.`,
    });
  };

  if (!canManage) return null;

  return (
    <ContentCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Qikink SKU import</div>
          <p style={{ ...smallText, margin: '4px 0 0' }}>
            Paste the SKU Descriptions export or upload its CSV, then choose which column is the Store SKU (long v-… code) and which is our Product SKU.
          </p>
          {mode ? (
            <p style={{ ...smallText, margin: '6px 0 0' }}>
              {mode.notice} {mode.configured ? 'Imports save to the live provider mapping table.' : 'Simulation labels apply to orders; mappings are saved for real.'}
            </p>
          ) : null}
        </div>
        {notice ? (
          <div role={notice.tone === 'error' ? 'alert' : 'status'} style={{ padding: '10px 12px', borderRadius: 8, fontSize: 13, background: noticeColors[notice.tone].background, color: noticeColors[notice.tone].color }}>
            {notice.text}
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <Input label="Product UUID" value={productId} placeholder="00000000-0000-4000-8000-000000000301" onChange={(event) => setProductId(event.target.value)} />
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button variant="secondary" size="md" disabled={busy} onClick={() => void loadProduct()}>Load variants</Button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input type="file" accept=".csv,text/csv" aria-label="Upload Qikink SKU CSV" onChange={(event) => void onFile(event)} />
          {fileName ? <span style={smallText}>{fileName}</span> : null}
        </div>
        <Textarea
          label="SKU Descriptions CSV"
          value={csvText}
          rows={6}
          placeholder={'Product,Color,Size,Store SKU,Product SKU\nClassic Tee,Black,M,v-24bk-m-001,TSH-BLK-M'}
          helperText={`${rows.length} rows parsed${table.headers.length ? ` · ${table.headers.length} columns` : ''}`}
          onChange={(event) => { setCsvText(event.target.value); setFileName(''); }}
        />
        {table.headers.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Select label="Product column" options={columnOptions} value={columns.product} onChange={(event) => setColumns({ ...columns, product: event.target.value })} />
            <Select label="Color column" options={columnOptions} value={columns.color} onChange={(event) => setColumns({ ...columns, color: event.target.value })} />
            <Select label="Size column" options={columnOptions} value={columns.size} onChange={(event) => setColumns({ ...columns, size: event.target.value })} />
            <Select label="Store SKU column (saved)" options={columnOptions} value={columns.storeSku} onChange={(event) => setColumns({ ...columns, storeSku: event.target.value })} />
            <Select label="Product SKU column (matching)" options={columnOptions} value={columns.productSku} onChange={(event) => setColumns({ ...columns, productSku: event.target.value })} />
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, ...smallText }}>
          <span>{variants.length} variants loaded</span>
          <span>{matched.rows.length} matched</span>
          <span>{matched.unmatched.length} unmatched</span>
          <span>{matched.skipped.length} without Store SKU</span>
          <span>{matched.duplicates.length} duplicate SKUs</span>
        </div>
        {matched.rows.length ? (
          <div style={{ maxHeight: 220, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th align="left">Store SKU</th>
                  <th align="left">Our SKU</th>
                  <th align="left">Variant</th>
                </tr>
              </thead>
              <tbody>
                {matched.rows.slice(0, 20).map((row, index) => {
                  const variant = variants.find((item) => item.id === row.variantId);
                  return (
                    <tr key={`${row.variantId}-${index}`}>
                      <td>{row.providerSku}</td>
                      <td>{row.payload.productSku ?? '—'}</td>
                      <td>{variant ? `${variant.color} / ${variant.size}` : row.variantId}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <div>
          <Button variant="primary" size="md" disabled={busy || !variants.length || !matched.rows.length || matched.duplicates.length > 0} onClick={() => void save()}>
            {busy ? 'Importing…' : `Import ${matched.rows.length} mappings`}
          </Button>
        </div>
      </div>
    </ContentCard>
  );
}
