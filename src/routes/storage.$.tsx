import { createAPIFileRoute } from '@tanstack/start/api'

export const Route = createAPIFileRoute('/storage/$')({
  handler: async ({ request, params }) => {
    // In TanStack Start API routes, the splat parameter is usually in params['_'] or similar
    // based on how the route is defined. For /storage/$, it's likely params['_']
    const path = params['_']
    
    if (!path) {
      return new Response('Not Found', { status: 404 })
    }

    try {
      // In Cloudflare Pages, bindings are available on the request.context or platform object
      // depending on the adapter. TanStack Start Cloudflare adapter usually puts them in request.env
      // @ts-ignore
      const r2 = request.env?.R2 || (globalThis as any).R2

      if (!r2) {
        console.error('R2 binding not found')
        return new Response('Storage configuration error', { status: 500 })
      }

      const object = await r2.get(path)

      if (!object) {
        return new Response('Not Found', { status: 404 })
      }

      const headers = new Headers()
      object.writeHttpMetadata(headers)
      headers.set('etag', object.httpEtag)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')

      return new Response(object.body, {
        headers,
      })
    } catch (error) {
      console.error('Error fetching from R2:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
})
