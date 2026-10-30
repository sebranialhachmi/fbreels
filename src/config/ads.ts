/**
 * Ad placements. A placement renders nothing in production unless an AdSense publisher id AND that slot id are
 * configured (a visible empty "إعلان" box is never shipped).
 */
export type AdPlacement = 'belowCalculator' | 'betweenSections' | 'inArticle';

export const adPlacements: Record<AdPlacement, { enabled: boolean; slotId: string; minHeight: number }> = {
  belowCalculator: { enabled: true, slotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BELOW_TOOL ?? '', minHeight: 280 },
  betweenSections: { enabled: true, slotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BETWEEN_SECTIONS ?? '', minHeight: 280 },
  inArticle: { enabled: true, slotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE ?? '', minHeight: 280 },
};
