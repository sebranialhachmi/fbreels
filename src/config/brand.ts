/** Central brand configuration. Change the name here or via NEXT_PUBLIC_BRAND_NAME. */
const DEFAULT_NAME = 'حاسبة مكافأة نهاية الخدمة';
// An earlier version of this project shipped .env.example with NEXT_PUBLIC_BRAND_NAME=ReelSave; ignore that stale value.
const configured = process.env.NEXT_PUBLIC_BRAND_NAME?.trim();

export const brand = {
  name: configured && configured.toLowerCase() !== 'reelsave' ? configured : DEFAULT_NAME,
  tagline: 'احسب مكافأة نهاية الخدمة وفق نظام العمل السعودي',
  themeColor: '#2563EB',
  backgroundColor: '#F9FAFB',
} as const;
