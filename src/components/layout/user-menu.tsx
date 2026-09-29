"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut, LayoutDashboard, User as UserIcon, LogIn, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function initials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

export function UserMenu({ className }: { className?: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Loading: render a placeholder to avoid layout shift.
  if (status === "loading") {
    return (
      <div
        className={cn(
          "h-9 w-9 animate-pulse rounded-full bg-muted",
          className,
        )}
        aria-hidden
      />
    );
  }

  // Not signed in: show Sign in / Register.
  if (!session?.user) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link href="/login">
            <LogIn className="mr-1.5 h-4 w-4" /> Sign in
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/register">
            <UserPlus className="mr-1.5 h-4 w-4" /> Register
          </Link>
        </Button>
      </div>
    );
  }

  const user = session.user;
  const isAdmin = user.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Open user menu"
        >
          <Avatar className="size-9 border">
            {user.image ? (
              <AvatarImage src={user.image} alt={user.name ?? user.email ?? "avatar"} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium truncate">{user.name ?? "Account"}</span>
          <span className="text-xs font-normal text-muted-foreground truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/dashboard")}>
          <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/dashboard?tab=api-keys")}>
          <UserIcon className="mr-2 h-4 w-4" /> Profile & API keys
        </DropdownMenuItem>
        {isAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/admin")}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> Admin
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
