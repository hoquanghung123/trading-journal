import { createFileRoute } from "@tanstack/react-router";
import { Terminal } from "@/components/journal/Terminal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ICT Trading Journal Terminal" },
      { name: "description", content: "Deep-navy terminal-style ICT trading journal with timeline, sessions, and clipboard paste." },
    ],
  }),
  component: Index,
});

function Index() {
  return <Terminal />;
}
