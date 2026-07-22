import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Budget',
    short_name: 'Budget',
    description: 'Personal finance dashboard',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0e17',
    theme_color: '#0a0e17',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
