export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  
  // Lấy phần path sau /storage/
  // Ví dụ: /storage/user_id/image.png -> user_id/image.png
  const path = context.params.path;
  const pathString = Array.isArray(path) ? path.join('/') : path;

  if (!pathString) {
    return new Response("Missing path", { status: 400 });
  }

  // Thay PROJECT_ID bằng Project ID thật từ .env
  const SUPABASE_PROJECT_ID = "mlyowmvrpjtqruramrhp"; 
  const BUCKET = "journal-charts";
  
  // URL gốc của Supabase
  const supabaseUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/${BUCKET}/${pathString}`;

  // Thực hiện fetch với tùy chọn cache của Cloudflare
  const response = await fetch(supabaseUrl, {
    cf: {
      // Yêu cầu Cloudflare cache mọi thứ (kể cả khi header gốc không cho phép)
      cacheEverything: true,
      // Thời gian cache 1 năm tại Edge
      cacheTtl: 31536000,
    }
  });

  // Tạo một response mới để tùy chỉnh header cache cho trình duyệt (Browser Cache)
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  newResponse.headers.set("X-Proxy-By", "Cloudflare-Pages-Function");

  return newResponse;
};
