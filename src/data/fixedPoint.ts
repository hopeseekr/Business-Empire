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

export interface SaleAllocation {
  /** Profit booked by this sale (negative only when a full exit closes a loss). */
  realized: string
  /** Relative cost basis after the sale; null when the position is liquidated. */
  relativeCostBasis: string | null
  /** Round-scoped realized profit after the sale; null when liquidated. */
  roundRealized: string | null
}

/**
 * Allocate sale proceeds to the position's available profit first.
 *
 * Available profit is the position's whole unbooked gain at the sale price —
 * market value minus the relative cost basis minus profit already banked this
 * round — which is exactly the Net P&L the Portfolio reports. Proceeds are
 * credited to that profit up to its full amount; anything beyond it is a return
 * of capital and books no gain. Selling while there is no profit available
 * realizes nothing and leaves Net P&L untouched: the relative basis simply
 * spreads over fewer units, so per-unit cost rises.
 *
 * A full exit has no position left to carry an unrecovered loss, so it closes
 * one into the trader log; the caller then resets the ledger (null fields).
 */
export function allocateSaleProceeds(
  sellPrice: string,
  heldShares: string,
  soldShares: string,
  relativeCostBasis: string,
  roundRealized: string,
  exactProceeds?: string,
): SaleAllocation | null {
  const price = parseFixed8(sellPrice)
  const held = parseFixed8(heldShares)
  const sold = parseFixed8(soldShares)
  const relative = parseFixed8(relativeCostBasis) ?? 0n
  const banked = parseFixed8(roundRealized) ?? 0n
  if (price == null || held == null || sold == null) return null
  if (price <= 0n || held <= 0n || sold <= 0n || sold > held) return null

  // Dollar-mode sells carry the exact amount entered, so the ledger stays exact
  // instead of drifting through a shares round-trip.
  const exact = exactProceeds != null ? parseFixed8(exactProceeds) : null
  const proceeds = exact != null && exact > 0n ? exact : roundedDivide(price * sold, FIXED_SCALE)

  const marketValue = roundedDivide(price * held, FIXED_SCALE)
  const available = marketValue - relative - banked
  const fullExit = sold === held

  // A unit count only resolves to eight decimals, so pricing a holding can land a
  // sliver off the exact ledger. Anything under a cent is that rounding noise
  // rather than money, and must never reach the trader log as a phantom lot.
  const MATERIAL = FIXED_SCALE / 100n

  let realized = 0n
  if (available > MATERIAL) {
    realized = proceeds < available ? proceeds : available
  } else if (fullExit && available < -MATERIAL) {
    realized = available
  }

  if (fullExit) {
    return { realized: formatFixed8(realized), relativeCostBasis: null, roundRealized: null }
  }
  return {
    realized: formatFixed8(realized),
    relativeCostBasis: formatFixed8(relative - proceeds),
    roundRealized: formatFixed8(banked + realized),
  }
}
