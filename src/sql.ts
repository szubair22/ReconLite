export function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

// Build a SQL expression that parses an accounting amount string into a DOUBLE.
//
// Sign rule: a sign-bearing SUFFIX (parens, trailing CR, trailing DR, trailing
// minus) is AUTHORITATIVE. The branch strips every non-magnitude character
// (including any leading or inner minus) and takes abs() of the magnitude,
// then applies its own sign. This prevents double-negation cases like
// "-100 CR" parsing as +100, and prevents "-100 DR" from staying negative.
//
// Branch order matters: parens first (so inner CR/DR/minus are ignored),
// then CR, then DR, then trailing minus, then the default leading-sign path.
//
// Truth table (verified against DuckDB 1.5.x; re-run if you touch the regex):
//   "100"          ->  100      (default; just digits)
//   "-100"         -> -100      (default; leading minus preserved)
//   "1,250.00"     ->  1250.0   (default; thousand separator stripped)
//   "1,234,567.89" ->  1234567.89
//   "$1,250.00"    ->  1250.0   (default; currency stripped)
//   "£1,250.00"    ->  1250.0
//   "€1,250.00"    ->  1250.0
//   "(100)"        -> -100      (parens authoritative)
//   "(1,250.00)"   -> -1250.0   (parens authoritative)
//   "100-"         -> -100      (trailing minus authoritative)
//   "100 CR"       -> -100      (CR authoritative)
//   "-100 CR"      -> -100      (CR authoritative; leading minus DROPPED via abs)
//   "100- CR"      -> -100      (CR authoritative; trailing minus DROPPED via abs)
//   "100 DR"       ->  100      (DR authoritative)
//   "-100 DR"      ->  100      (DR authoritative; leading minus DROPPED via abs)
//   "100- DR"      ->  100      (DR authoritative; trailing minus DROPPED via abs)
//   "100cr"/"Dr"   ->  -100/100 (case-insensitive; no-space variant)
//   ""             ->  null     (empty/whitespace)
//   "1.250,00"     ->  null     (EU comma-decimal: comma-after-dot is rejected)
//   "1.2.3.4"      ->  null     (multi-dot guard)
export function amountExpression(columnName: string): string {
  const raw = `cast(${quoteIdent(columnName)} as varchar)`;
  // Magnitude only: digits and decimal point. No minus. Used by every
  // sign-bearing branch so inner/leading minuses can't double-up the sign.
  const magnitudeRaw = `regexp_replace(${raw}, '[^0-9.]', '', 'g')`;
  // Reject multi-dot strings. EU comma-decimal like "1.250,00" survives the
  // comma strip as "1.250.00", and DuckDB's try_cast would otherwise parse
  // it permissively as 1.25 — surfacing as unparsed is the safer fallback.
  const magnitude = `(case when regexp_matches(${magnitudeRaw}, '\\..*\\.') then null else ${magnitudeRaw} end)`;
  // Default branch: keep a leading minus so "-100" parses as -100. Same
  // multi-dot guard applies.
  const signedRaw = `regexp_replace(${raw}, '[^0-9.\\-]', '', 'g')`;
  const signed = `(case when regexp_matches(${signedRaw}, '\\..*\\.') then null else ${signedRaw} end)`;

  return `
    case
      when ${raw} is null or trim(${raw}) = '' then null
      -- Comma AFTER a dot is malformed in US notation (e.g. EU "1.250,00").
      -- Without this gate, the comma strip yields "1.25000" which try_cast
      -- happily parses as 1.25 — silently wrong instead of surfaced as unparsed.
      when regexp_matches(${raw}, '\\.[^.]*,') then null
      when regexp_matches(trim(${raw}), '^\\(.*\\)$') then -1 * abs(try_cast(${magnitude} as double))
      when regexp_matches(trim(${raw}), '(?i)\\s*CR\\s*$') then -1 * abs(try_cast(${magnitude} as double))
      when regexp_matches(trim(${raw}), '(?i)\\s*DR\\s*$') then abs(try_cast(${magnitude} as double))
      when regexp_matches(trim(${raw}), '-\\s*$') then -1 * abs(try_cast(${magnitude} as double))
      else try_cast(${signed} as double)
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
