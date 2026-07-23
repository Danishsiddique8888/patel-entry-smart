import { createFileRoute } from "@tanstack/react-router";
import VisitorRegistration from "@/components/VisitorRegistration";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Patel Residency — Visitor Registration" },
      {
        name: "description",
        content:
          "Register your visit at Patel Residency. Secure, fast visitor entry with resident approval.",
      },
      { property: "og:title", content: "Patel Residency — Visitor Registration" },
      {
        property: "og:description",
        content:
          "Register your visit at Patel Residency. Secure, fast visitor entry with resident approval.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VisitorRegistration,
});
