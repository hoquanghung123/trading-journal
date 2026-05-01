import { createFileRoute } from "@tanstack/react-router";

// Fresh build trigger after environment variable update
export const Route = createFileRoute("/hello")({
  component: () => <div>Hello World</div>,
});
