import { createFileRoute } from '@tanstack/react-router'
import { fetchFromR2 } from '../lib/storage'

export const Route = createFileRoute('/storage/$')({
  loader: async ({ params }) => {
    const path = params['*']
    // Call the server function. In TanStack Start, server functions
    // automatically handle the transition to server-side logic.
    return fetchFromR2({ data: path })
  },
})
