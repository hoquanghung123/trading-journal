import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

function RedirectToProgress() {
  useEffect(() => {
    window.location.replace("/?page=progress");
  }, []);
  return null;
}

export const Route = createFileRoute("/progress")({
  component: RedirectToProgress,
});
