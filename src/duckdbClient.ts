import * as duckdb from '@duckdb/duckdb-wasm';
import duckdbWasmMvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdbWasmEh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { BalanceRow, SourceKind, TableProfile } from './types';
import { accountExpression, amountExpression, quoteLiteral } from './sql';

const TABLE_NAMES: Record<SourceKind, string> = {
  gl: 'gl_raw',
  subledger: 'subledger_raw'
};

const FILE_NAMES: Record<SourceKind, string> = {
  gl: 'gl.csv',
  subledger: 'subledger.csv'
};

export class ReconDuckDb {
  private db?: AsyncDuckDB;
  private conn?: AsyncDuckDBConnection;

  async init(): Promise<void> {
    if (this.db && this.conn) return;

    const bundles: duckdb.DuckDBBundles = {
      mvp: {
        mainModule: duckdbWasmMvp,
        mainWorker: mvpWorker
      },
      eh: {
        mainModule: duckdbWasmEh,
        mainWorker: ehWorker
      }
    };

    const bundle = await duckdb.selectBundle(bundles);
    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);

    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    this.db = db;
    this.conn = await db.connect();
  }

  async reset(): Promise<void> {
    if (!this.conn) return;
    await this.conn.query('drop table if exists gl_raw');
    await this.conn.query('drop table if exists subledger_raw');
    await this.conn.query('drop table if exists gl_balances');
    await this.conn.query('drop table if exists subledger_balances');
    await this.conn.query('drop table if exists balance_compare');
  }

  async loadCsv(source: SourceKind, file: File): Promise<TableProfile> {
    await this.init();
    if (!this.db || !this.conn) throw new Error('DuckDB is not initialized.');

    const fileName = FILE_NAMES[source];
    const tableName = TABLE_NAMES[source];
    const buffer = new Uint8Array(await file.arrayBuffer());

    await this.db.registerFileBuffer(fileName, buffer);
    await this.conn.query(`drop table if exists ${tableName}`);
    await this.conn.query(`
      create table ${tableName} as
      select *
      from read_csv_auto(${quoteLiteral(fileName)}, header = true, all_varchar = true)
    `);

    return this.profileTable(source);
  }

  async profileTable(source: SourceKind): Promise<TableProfile> {
    if (!this.conn) throw new Error('DuckDB is not initialized.');
    const tableName = TABLE_NAMES[source];

    const columnsResult = await this.conn.query(`pragma table_info(${quoteLiteral(tableName)})`);
    const columns = toObjects(columnsResult).map((row) => String(row.name));

    const countResult = await this.conn.query(`select count(*)::integer as row_count from ${tableName}`);
    const rowCount = Number(toObjects(countResult)[0]?.row_count ?? 0);

    const previewResult = await this.conn.query(`select * from ${tableName} limit 5`);
    const previewRows = toObjects(previewResult);

    return { source, tableName, rowCount, columns, previewRows };
  }

  async buildBalanceSummary(args: {
    glAccountColumn: string;
    glAmountColumn: string;
    subledgerAccountColumn: string;
    subledgerAmountColumn: string;
  }): Promise<BalanceRow[]> {
    if (!this.conn) throw new Error('DuckDB is not initialized.');

    await this.conn.query(`
      create or replace table gl_balances as
      select
        'GL' as source,
        ${accountExpression(args.glAccountColumn)} as account,
        round(sum(coalesce(${amountExpression(args.glAmountColumn)}, 0)), 2) as balance,
        count(*)::integer as row_count
      from gl_raw
      group by 1, 2
    `);

    await this.conn.query(`
      create or replace table subledger_balances as
      select
        'Subledger' as source,
        ${accountExpression(args.subledgerAccountColumn)} as account,
        round(sum(coalesce(${amountExpression(args.subledgerAmountColumn)}, 0)), 2) as balance,
        count(*)::integer as row_count
      from subledger_raw
      group by 1, 2
    `);

    const result = await this.conn.query(`
      select * from gl_balances
      union all
      select * from subledger_balances
      order by account, source
    `);

    return toObjects(result) as BalanceRow[];
  }

  async buildBalanceCompare(): Promise<Record<string, unknown>[]> {
    if (!this.conn) throw new Error('DuckDB is not initialized.');

    const result = await this.conn.query(`
      select
        coalesce(gl.account, sub.account) as account,
        coalesce(gl.balance, 0) as gl_balance,
        coalesce(sub.balance, 0) as subledger_balance,
        round(coalesce(gl.balance, 0) - coalesce(sub.balance, 0), 2) as difference,
        coalesce(gl.row_count, 0) as gl_rows,
        coalesce(sub.row_count, 0) as subledger_rows
      from gl_balances gl
      full outer join subledger_balances sub using (account)
      order by abs(round(coalesce(gl.balance, 0) - coalesce(sub.balance, 0), 2)) desc, account
    `);

    return toObjects(result);
  }
}

export function toObjects(table: { toArray: () => unknown[] }): Record<string, unknown>[] {
  return table.toArray().map((row: any) => {
    if (row && typeof row.toJSON === 'function') return row.toJSON();
    return { ...row };
  });
}
