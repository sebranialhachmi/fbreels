import type { MetadataRoute } from 'next';
import { brand } from '@/config/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: 'Check and save supported public Facebook Reels and videos.',
    start_url: '/',
    display: 'standalone',
    background_color: brand.backgroundColor,
    theme_color: brand.themeColor,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
