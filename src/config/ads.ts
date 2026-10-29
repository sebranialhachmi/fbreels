/**
 * Ad placements. Toggle `enabled` per placement; supply the AdSense ad-unit slot id via the
 * matching env var. A placement renders nothing in production unless an AdSense publisher id
 * AND that slot id are configured (a visible empty "Advertisement" box is never shipped).
 */
export type AdPlacement = 'belowTool' | 'betweenSections' | 'inArticle' | 'sidebar' | 'aboveFooter';

export const adPlacements: Record<
  AdPlacement,
  { enabled: boolean; slotId: string; minHeight: number }
> = {
  belowTool: {
    enabled: true,
    slotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BELOW_TOOL ?? '',
    minHeight: 280,
  },
  betweenSections: {
    enabled: true,
    slotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BETWEEN_SECTIONS ?? '',
    minHeight: 280,
  },
  inArticle: {
    enabled: true,
    slotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE ?? '',
    minHeight: 280,
  },
  sidebar: {
    enabled: true,
    slotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR ?? '',
    minHeight: 600,
  },
  aboveFooter: {
    enabled: false,
    slotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ABOVE_FOOTER ?? '',
    minHeight: 250,
  },
};
