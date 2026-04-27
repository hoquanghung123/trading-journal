import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/storage/$')({
  loader: async ({ params }) => {
    const path = params._splat;
    
    if (!path) {
      throw new Response('Missing path', { status: 400 });
    }

    const SUPABASE_PROJECT_ID = 'mlyowmvrpjtqruramrhp';
    const BUCKET = 'journal-charts';
    const supabaseUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/${BUCKET}/${path}`;

    try {
      const response = await fetch(supabaseUrl);
      
      if (!response.ok) {
        throw new Response('Image not found', { status: 404 });
      }

      // Trả về trực tiếp Response của fetch (bao gồm cả body là stream)
      // Thêm cache header để Cloudflare CDN ghi nhớ
      const newResponse = new Response(response.body, {
        headers: {
          ...Object.fromEntries(response.headers),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });

      return newResponse;
    } catch (error) {
      throw new Response('Internal Server Error', { status: 500 });
    }
  },
  // Chúng ta không cần component vì loader đã trả về Response trực tiếp
  component: () => null,
});
