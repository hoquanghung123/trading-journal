export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Kiểm tra nếu là yêu cầu lấy ảnh
    if (url.pathname.startsWith("/storage/")) {
      const path = url.pathname.replace("/storage/", "");
      const SUPABASE_PROJECT_ID = "mlyowmvrpjtqruramrhp";
      const BUCKET = "journal-charts";
      const supabaseUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/${BUCKET}/${path}`;

      try {
        const response = await fetch(supabaseUrl);
        if (!response.ok) {
          return new Response("Image not found", { status: 404 });
        }

        // Tạo response mới với Header cache cực mạnh (1 năm)
        const newResponse = new Response(response.body, response);
        newResponse.headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return newResponse;
      } catch (e) {
        return new Response("Proxy Error", { status: 500 });
      }
    }

    // 2. Nếu không phải ảnh, hãy để ứng dụng chính xử lý
    // Chúng ta sẽ import worker của TanStack được build ra
    // Lưu ý: Tên file này sẽ là _orig_worker.js sau khi chúng ta đổi tên ở bước build
    try {
      const worker = await import("./_orig_worker.js");
      return await worker.default.fetch(request, env, ctx);
    } catch (e) {
      // Fallback nếu chưa có _orig_worker.js (ví dụ trong môi trường dev)
      return fetch(request);
    }
  },
};
