// Preistabelle fuer ElevenLabs, Quelle: elevenlabs.io/pricing, abgerufen 2026-09-19,
// siehe Vault-Notiz 10_Projekte/FutureDev/Wissen/kosten.md Abschnitt 1.
// USD/1.000 Zeichen ist berechnet (Monatspreis geteilt durch Zeichenkontingent), keine
// Anbieterangabe.

export interface PricingTier {
  readonly name: string;
  readonly monthlyUsd: number;
  readonly charactersPerMonth: number;
  readonly usdPer1000Chars: number;
}

export const PRICING_TIERS: readonly PricingTier[] = [
  { name: 'Starter', monthlyUsd: 6, charactersPerMonth: 30_000, usdPer1000Chars: 0.2 },
  { name: 'Creator', monthlyUsd: 22, charactersPerMonth: 121_000, usdPer1000Chars: 0.18 },
  { name: 'Pro', monthlyUsd: 99, charactersPerMonth: 600_000, usdPer1000Chars: 0.165 },
  { name: 'Scale', monthlyUsd: 299, charactersPerMonth: 1_800_000, usdPer1000Chars: 0.166 },
  { name: 'Business', monthlyUsd: 990, charactersPerMonth: 6_000_000, usdPer1000Chars: 0.165 },
];

export interface CostEstimate {
  readonly tier: string;
  readonly usd: number;
  readonly fitsInOneMonth: boolean;
}

/**
 * Schaetzt die Kosten fuer eine Zeichenzahl je Tarif. Der USD-Betrag ist der
 * Zeichenpreis mal Zeichenzahl (Naeherung, keine Ueberschreitungsgebuehr
 * beruecksichtigt), unabhaengig davon, ob die Zeichenzahl in einen Monat passt.
 * `fitsInOneMonth` zeigt an, ob das Monatskontingent des Tarifs ausreicht.
 */
export function estimateCostByTier(characters: number): CostEstimate[] {
  return PRICING_TIERS.map((tier) => ({
    tier: tier.name,
    usd: Math.round((characters / 1000) * tier.usdPer1000Chars * 100) / 100,
    fitsInOneMonth: characters <= tier.charactersPerMonth,
  }));
}
