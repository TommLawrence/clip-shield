import { createFileRoute } from "@tanstack/react-router";
import { readFirebaseConfig } from "@/lib/firebase-config.server";

export const Route = createFileRoute("/api/firebase-config")({
  server: {
    handlers: {
      GET: async () => Response.json(readFirebaseConfig()),
    },
  },
});