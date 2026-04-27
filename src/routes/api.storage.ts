import { createAPIFileRoute } from '@tanstack/react-start/api';

export const Route = createAPIFileRoute('/api/storage')({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    // Lấy path từ query hoặc từ URL
    // Ví dụ: /api/storage?path=user_id/image.png
    const path = url.searchParams.get('path');

    if (!path) {
      return new Response('Missing path', { status: 400 });
    }

    const SUPABASE_PROJECT_ID = 'mlyowmvrpjtqruramrhp';
    const BUCKET = 'journal-charts';
    const supabaseUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/${BUCKET}/${path}`;

    const response = await fetch(supabaseUrl);
    
    // Tạo response mới với header cache
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    
    return newResponse;
  },
});
