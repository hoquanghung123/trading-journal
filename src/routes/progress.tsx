import { createFileRoute } from "@tanstack/react-router";
import { ProgressView } from "@/components/journal/ProgressView";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Progress Tracker | ICT Journal" },
      {
        name: "description",
        content: "Track your trading discipline and streaks.",
      },
    ],
  }),
  component: ProgressView,
});
