// Steam currency codes + price-text parsing.
//
// Steam's priceoverview returns locale-formatted strings ("$0.04", "R$ 0,17",
// "1.234,56 zl", ...). We keep the raw text for display and derive a numeric
// value for summing. The currency param of priceoverview is honored (unlike
// search/render) - see docs/findings/steam-market.md.

export interface SteamCurrency {
  code: number; // Steam's numeric currency id
  iso: string; // ISO 4217-ish code we expose in config/UI
  label: string;
}

// Common subset of Steam's wallet currencies. Extend as needed.
export const STEAM_CURRENCIES: SteamCurrency[] = [
  { code: 1, iso: "USD", label: "US Dollar" },
  { code: 2, iso: "GBP", label: "British Pound" },
  { code: 3, iso: "EUR", label: "Euro" },
  { code: 4, iso: "CHF", label: "Swiss Franc" },
  { code: 5, iso: "RUB", label: "Russian Ruble" },
  { code: 6, iso: "PLN", label: "Polish Zloty" },
  { code: 7, iso: "BRL", label: "Brazilian Real" },
  { code: 8, iso: "JPY", label: "Japanese Yen" },
  { code: 9, iso: "NOK", label: "Norwegian Krone" },
  { code: 13, iso: "SGD", label: "Singapore Dollar" },
  { code: 16, iso: "KRW", label: "South Korean Won" },
  { code: 17, iso: "TRY", label: "Turkish Lira" },
  { code: 19, iso: "MXN", label: "Mexican Peso" },
  { code: 20, iso: "CAD", label: "Canadian Dollar" },
  { code: 21, iso: "AUD", label: "Australian Dollar" },
  { code: 23, iso: "CNY", label: "Chinese Yuan" },
  { code: 24, iso: "INR", label: "Indian Rupee" },
  { code: 29, iso: "HKD", label: "Hong Kong Dollar" },
];

const BY_ISO = new Map(STEAM_CURRENCIES.map((c) => [c.iso, c]));

export function currencyByIso(iso: string): SteamCurrency {
  return BY_ISO.get(iso.toUpperCase()) ?? STEAM_CURRENCIES[0];
}

export function currencyCode(iso: string): number {
  return currencyByIso(iso).code;
}

/**
 * Parse a Steam money string into a numeric value in major units.
 *
 * The last `,` or `.` is the decimal point UNLESS it's followed by exactly 3
 * digits, in which case it's a thousands grouping separator (so "1,500" -> 1500
 * for KRW, but "0,17" -> 0.17 for BRL). Earlier separators are always grouping.
 * Returns null when no digits are present.
 */
export function parseMoney(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.,]/g, "");
  if (!cleaned) return null;

  const lastSep = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  const trailing = lastSep === -1 ? 0 : cleaned.length - lastSep - 1;
  const isDecimal = lastSep !== -1 && trailing !== 3;

  let value: number;
  if (!isDecimal) {
    value = Number(cleaned.replace(/[.,]/g, ""));
  } else {
    const intPart = cleaned.slice(0, lastSep).replace(/[.,]/g, "");
    const fracPart = cleaned.slice(lastSep + 1).replace(/[.,]/g, "");
    value = Number(`${intPart}.${fracPart}`);
  }
  return Number.isFinite(value) ? value : null;
}
