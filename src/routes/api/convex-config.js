import { createFileRoute } from "@tanstack/react-router";
import { readConvexConfig } from "@/lib/convex-config.server";

export const Route = createFileRoute("/api/convex-config")({
  server: {
    handlers: {
      GET: async () => Response.json(readConvexConfig()),
    },
  },
});