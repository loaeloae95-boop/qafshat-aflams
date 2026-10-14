import { Link } from "@tanstack/react-router";
import { Flame, Home, Library, Upload, User } from "lucide-react";
import type { ReactNode } from "react";
import { QuickSearchButton } from "./QuickSearch";

const navItems = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/trending", label: "رائج", icon: Flame },
  { to: "/studio", label: "رفع", icon: Upload },
  { to: "/library", label: "مكتبتي", icon: Library },
  { to: "/account", label: "حسابي", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-48">
      <div className="mx-auto w-full max-w-md px-4 pt-6">{children}</div>
      <QuickSearchButton />
      <nav className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto max-w-md px-4 pb-4">
          <ul className="glass-panel flex items-center justify-between rounded-3xl px-3 py-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className="flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] text-muted-foreground transition"
                  activeOptions={{ exact: to === "/" }}
                  activeProps={{ className: "text-primary font-bold" }}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}
