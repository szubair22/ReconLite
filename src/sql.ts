export function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

// Build a SQL expression that parses an accounting amount string into a DOUBLE.
// Handled formats:
//   - Plain numbers with thousand separators: 1,250.00 -> 1250.00
//   - Currency symbols: $1,250.00 / £1,250.00 / €1,250.00 -> 1250.00
//   - Parentheses for negative: (1,250.00) -> -1250.00
//   - Trailing CR (credit, negative): 1,250.00 CR -> -1250.00
//   - Trailing DR (debit, explicit positive): 1,250.00 DR -> 1250.00
//   - Trailing minus: 1,250.00- -> -1250.00
// Case-cascade order matters: CR/DR must be stripped before the generic
// currency-symbol path, and parens must come first so an inner trailing
// minus isn't mistaken for the wrapping syntax.
export function amountExpression(columnName: string): string {
  const raw = `cast(${quoteIdent(columnName)} as varchar)`;
  // Generic numeric clean (digits, decimal, minus only)
  const cleaned = `regexp_replace(${raw}, '[^0-9.\\-]', '', 'g')`;
  // Strip a trailing CR or DR (case-insensitive) then generic-clean
  const stripCr = `regexp_replace(regexp_replace(${raw}, '(?i)\\s*CR$', '', 'g'), '[^0-9.\\-]', '', 'g')`;
  const stripDr = `regexp_replace(regexp_replace(${raw}, '(?i)\\s*DR$', '', 'g'), '[^0-9.\\-]', '', 'g')`;
  // Strip trailing minus then generic-clean
  const stripTrailMinus = `regexp_replace(regexp_replace(${raw}, '-\\s*$', '', 'g'), '[^0-9.\\-]', '', 'g')`;

  return `
    case
      when ${raw} is null or trim(${raw}) = '' then null
      when regexp_matches(trim(${raw}), '^\\(.*\\)$') then -1 * try_cast(${cleaned} as double)
      when regexp_matches(trim(${raw}), '(?i)\\s*CR$') then -1 * try_cast(${stripCr} as double)
      when regexp_matches(trim(${raw}), '(?i)\\s*DR$') then try_cast(${stripDr} as double)
      when regexp_matches(trim(${raw}), '-\\s*$') then -1 * try_cast(${stripTrailMinus} as double)
      else try_cast(${cleaned} as double)
    end
  `;
}

// Returns a SQL expression that yields 1 when a row has a non-empty raw value
// but amountExpression would yield NULL (i.e. unparseable amount), else 0.
// Sum this across a source to surface "rows excluded from balance" to the UI.
export function unparsedAmountFlag(columnName: string): string {
  const raw = `cast(${quoteIdent(columnName)} as varchar)`;
  return `
    case
      when ${raw} is null or trim(${raw}) = '' then 0
      when (${amountExpression(columnName)}) is null then 1
      else 0
    end
  `;
}

export function accountExpression(columnName: string): string {
  return `coalesce(nullif(trim(cast(${quoteIdent(columnName)} as varchar)), ''), '(blank)')`;
}
