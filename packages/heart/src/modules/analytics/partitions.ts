import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '../../platform/db/index.ts';

const PARTITIONED = ['page_views', 'product_views', 'cart_events', 'search_terms'] as const;
type PartitionedTable = typeof PARTITIONED[number];

const RETENTION_DAYS: Record<PartitionedTable, number> = {
  page_views: 30,
  product_views: 30,
  cart_events: 30,
  search_terms: 90,
};

function monthParts(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return {
    year,
    month,
    suffix: `${year}_${String(month).padStart(2, '0')}`,
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
  };
}

export interface PartitionMaintenanceResult {
  created: string[];
  dropped: string[];
}

export async function maintainAnalyticsPartitions(now = new Date()): Promise<PartitionMaintenanceResult> {
  const db = getDb();
  const target = monthParts(now);
  const created: string[] = [];
  const dropped: string[] = [];

  for (const table of PARTITIONED) {
    const name = `${table}_${target.suffix}`;
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(name)} PARTITION OF ${sql.identifier(table)}
      FOR VALUES FROM (${sql.raw(`'${target.start}'`)}) TO (${sql.raw(`'${target.end}'`)})`);
    created.push(name);

    const cutoff = new Date(now.getTime() - RETENTION_DAYS[table] * 86400000);
    const { rows } = await db.execute<{ name: string }>(sql`
      SELECT child.relname AS name
      FROM pg_inherits i
      JOIN pg_class child ON child.oid = i.inhrelid
      JOIN pg_class parent ON parent.oid = i.inhparent
      WHERE parent.relname = ${table}`);

    for (const row of rows) {
      const match = row.name.match(new RegExp(`^${table}_(\\d{4})_(\\d{2})$`));
      if (!match) continue;
      const start = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
      if (start >= cutoff) continue;
      await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(row.name)}`);
      dropped.push(row.name);
    }
  }

  return { created, dropped };
}
