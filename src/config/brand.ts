/**
 * Central brand configuration. Change the name here (or via NEXT_PUBLIC_BRAND_NAME)
 * and it propagates to the UI, metadata, structured data and long-form content.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || 'ReelSave',
  /** Used in the web app manifest. */
  themeColor: '#2563EB',
  backgroundColor: '#F9FAFB',
} as const;

export type Brand = typeof brand;
