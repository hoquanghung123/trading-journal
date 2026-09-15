import { createFileRoute } from "@tanstack/react-router";
import { Terminal } from "@/components/journal/Terminal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chartmate" },
      {
        name: "description",
        content: "ICT trading journal with bias, trades, playbook, and weekly review.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <Terminal />;
}
