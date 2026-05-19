export function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function amountExpression(columnName: string): string {
  const col = `cast(${quoteIdent(columnName)} as varchar)`;
  const cleaned = `regexp_replace(${col}, '[^0-9.\\-]', '', 'g')`;

  return `
    case
      when ${col} is null or trim(${col}) = '' then null
      when regexp_matches(trim(${col}), '^\\(.*\\)$') then -1 * try_cast(${cleaned} as double)
      else try_cast(${cleaned} as double)
    end
  `;
}

export function accountExpression(columnName: string): string {
  return `coalesce(nullif(trim(cast(${quoteIdent(columnName)} as varchar)), ''), '(blank)')`;
}
