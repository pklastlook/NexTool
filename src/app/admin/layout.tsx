import { AdminNav } from "@/components/admin/admin-nav";

/**
 * Admin layout (Prompt2 §62).
 *
 * Server component. Provides a sticky sidebar (desktop) / top nav (mobile)
 * and an explicit warning banner that there is NO admin auth gate in the
 * sandbox. Real admin auth is task P2-5.
 *
 * NOTE: In production this layout would wrap children in an admin-auth guard
 * (server-side session check) before rendering. We deliberately do not do that
 * here — see worklog.
 */

export const metadata = {
  title: "Admin",
  description: "NexTool administration & observability console.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      {/* Desktop sidebar offset */}
      <div className="md:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
