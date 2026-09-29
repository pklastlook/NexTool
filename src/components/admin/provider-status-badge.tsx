import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import type { ProviderHealth } from "@/lib/providers";

export const PROVIDER_STATUS_STYLE: Record<
  ProviderHealth["status"],
  { label: string; icon: React.ComponentType<{ className?: string }>; badge: "default" | "secondary" | "destructive" | "outline" }
> = {
  configured: { label: "Configured", icon: CheckCircle2, badge: "default" },
  not_configured: { label: "Not configured", icon: XCircle, badge: "outline" },
  failed: { label: "Failed", icon: AlertTriangle, badge: "destructive" },
};

export function ProviderStatusBadge({ status }: { status: ProviderHealth["status"] }) {
  const s = PROVIDER_STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <Badge variant={s.badge} className="gap-1.5">
      <Icon className="size-3.5" />
      {s.label}
    </Badge>
  );
}
