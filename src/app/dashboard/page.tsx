import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Mail, Shield, Key, History, CheckCircle2, AlertCircle } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard",
};

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive"> = {
  completed: "default",
  failed: "destructive",
  cancelled: "secondary",
  created: "secondary",
  queued: "secondary",
  processing: "secondary",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const userId = session.user.id;

  // Real DB queries — no fabricated metrics.
  const [user, recentJobs, apiKeyCount, totalJobs] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    }),
    db.processingJob.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { tool: { select: { name: true, slug: true } } },
    }),
    db.apiKey.count({
      where: { userId, revokedAt: null },
    }),
    db.processingJob.count({ where: { userId } }),
  ]);

  if (!user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const activeSub = await db.subscription.findFirst({
    where: { userId, status: "active" },
    include: { plan: { select: { slug: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your account, jobs and API keys.
          </p>
        </div>
        <Button asChild>
          <Link href="/tools">Browse tools</Link>
        </Button>
      </div>

      {/* Profile cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email
            </CardDescription>
            <CardTitle className="truncate text-base font-medium">{user.email}</CardTitle>
          </CardHeader>
          <CardContent>
            {user.emailVerified ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Verified
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" /> Not verified
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Role
            </CardDescription>
            <CardTitle className="text-base font-medium capitalize">{user.role}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Joined {new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" /> Plan
            </CardDescription>
            <CardTitle className="text-base font-medium capitalize">
              {activeSub?.plan.name ?? "Free"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              {activeSub ? `Status: ${activeSub.status}` : "Upgrade for more usage"}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" /> API Keys
            </CardDescription>
            <CardTitle className="text-base font-medium">{apiKeyCount} active</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              <Link href="/api-docs" className="hover:underline">Read API docs →</Link>
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Recent jobs */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Recent jobs
          </CardTitle>
          <CardDescription>
            Your last {recentJobs.length === 0 ? 0 : Math.min(recentJobs.length, 10)} of {totalJobs} total jobs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <p className="text-sm text-muted-foreground">You haven&apos;t run any tools yet.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/tools">Browse tools</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Tool</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <Link
                          href={`/tools/${job.tool.slug}`}
                          className="font-medium hover:underline"
                        >
                          {job.tool.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={STATUS_BADGE[job.status] ?? "secondary"}>
                          {job.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stub note */}
      <p className="mt-6 text-xs text-muted-foreground">
        Dashboard is a stub — API key management, billing and history views are coming.
      </p>
    </div>
  );
}
