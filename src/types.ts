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
};
