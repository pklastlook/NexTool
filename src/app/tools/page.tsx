import { Suspense } from "react";
import { AllToolsClient } from "./all-tools-client";

export const metadata = {
  title: "All tools",
  description: "Browse every tool available on NexTool.",
};

export default function AllToolsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-10">Loading…</div>}>
      <AllToolsClient />
    </Suspense>
  );
}
