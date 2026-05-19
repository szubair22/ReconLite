export type SourceKind = 'gl' | 'subledger';

export type TableProfile = {
  source: SourceKind;
  tableName: string;
  rowCount: number;
  columns: string[];
  previewRows: Record<string, unknown>[];
};

export type MappingState = {
  glAccountColumn: string;
  glAmountColumn: string;
  subledgerAccountColumn: string;
  subledgerAmountColumn: string;
};

export type BalanceRow = {
  source: string;
  account: string;
  balance: number;
  row_count: number;
  unparsed_rows: number;
};

export type CompareRow = {
  account: string;
  gl_balance: number;
  subledger_balance: number;
  difference: number;
  gl_rows: number;
  subledger_rows: number;
  status: string;
  unparsed_rows: number;
};
