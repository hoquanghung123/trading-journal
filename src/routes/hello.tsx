import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/hello")({
  component: () => <div>Hello World</div>,
});
