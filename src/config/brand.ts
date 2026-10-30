/** Central brand configuration. Change the name here or via NEXT_PUBLIC_BRAND_NAME. */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || 'حاسبة مكافأة نهاية الخدمة',
  tagline: 'احسب مكافأة نهاية الخدمة وفق نظام العمل السعودي',
  themeColor: '#2563EB',
  backgroundColor: '#F9FAFB',
} as const;
