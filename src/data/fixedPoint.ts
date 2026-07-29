/** Exact decimal arithmetic for the application's eight-decimal accounting values. */
export const FIXED_SCALE = 100000000n

export function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error('Cannot divide by zero')
  const sign = numerator < 0n ? -1n : 1n
  const value = numerator < 0n ? -numerator : numerator
  const quotient = value / denominator
  const remainder = value % denominator
  return sign * (quotient + (remainder * 2n >= denominator ? 1n : 0n))
}

/**
 * Parse a non-exponential decimal into eight-decimal fixed-point units.
 * Extra fraction digits beyond the eighth are rounded away (round-half-up),
 * not rejected — a price like "9.933540538" is still a valid price.
 */
export function parseFixed8(raw: string): bigint | null {
  const value = raw.trim()
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(value)
  if (!match) return null
  const whole = match[2] ?? '0'
  const fraction = match[3] ?? match[4] ?? ''
  const kept = (fraction + '00000000').slice(0, 8)
  const roundUp = fraction.length > 8 && fraction[8] >= '5'
  const units = BigInt(whole) * FIXED_SCALE + BigInt(kept) + (roundUp ? 1n : 0n)
  return match[1] === '-' ? -units : units
}

/** Format fixed-point units as a compact decimal string with at most eight places. */
export function formatFixed8(units: bigint): string {
  const sign = units < 0n ? '-' : ''
  const absolute = units < 0n ? -units : units
  const whole = absolute / FIXED_SCALE
  const fraction = (absolute % FIXED_SCALE).toString().padStart(8, '0').replace(/0+$/, '')
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`
}

// An empty operand means "no shares yet" (e.g. a first-ever buy), not bad input — treat as 0.
export function addFixed8(left: string, right: string): string | null {
  const a = parseFixed8(left) ?? 0n
  const b = parseFixed8(right) ?? 0n
  return formatFixed8(a + b)
}

export function subtractFixed8(left: string, right: string): string | null {
  const a = parseFixed8(left) ?? 0n
  const b = parseFixed8(right) ?? 0n
  return formatFixed8(a - b)
}

/** Divide two fixed-point values and round the result to fixed-point precision. */
export function divideFixed8(left: string, right: string): string | null {
  const numerator = parseFixed8(left)
  const denominator = parseFixed8(right)
  if (numerator == null || denominator == null || denominator === 0n) return null
  return formatFixed8(roundedDivide(numerator * FIXED_SCALE, denominator))
}

/** Multiply two fixed-point values and round the result to fixed-point precision. */
export function multiplyFixed8(left: string, right: string): string | null {
  const a = parseFixed8(left)
  const b = parseFixed8(right)
  if (a == null || b == null) return null
  return formatFixed8(roundedDivide(a * b, FIXED_SCALE))
}

/** Weighted average cost, rounded once to the eight-decimal storage precision. */
export function weightedAverageCost(
  heldShares: string,
  costBasis: string,
  buyShares: string,
  buyPrice: string,
): string | null {
  // No prior holding (e.g. first-ever buy) is a valid starting point, not bad input.
  const held = parseFixed8(heldShares) ?? 0n
  const basis = parseFixed8(costBasis) ?? 0n
  const bought = parseFixed8(buyShares)
  const price = parseFixed8(buyPrice)
  if (bought == null || price == null || held < 0n || bought <= 0n || price <= 0n) return null
  // Basis only matters when averaging against real prior shares.
  if (held > 0n && basis <= 0n) return null
  const totalShares = held + bought
  if (totalShares <= 0n) return null
  return formatFixed8(roundedDivide(held * basis + bought * price, totalShares))
}

/** Realized P&L for a sell lot, represented at exact eight-decimal precision. */
export function realizedSellPnl(
  sellPrice: string,
  costBasis: string,
  sharesSold: string,
): string | null {
  const sell = parseFixed8(sellPrice)
  const basis = parseFixed8(costBasis)
  const shares = parseFixed8(sharesSold)
  if (sell == null || basis == null || shares == null || sell <= 0n || basis <= 0n || shares <= 0n) return null
  return formatFixed8(roundedDivide((sell - basis) * shares, FIXED_SCALE))
}
