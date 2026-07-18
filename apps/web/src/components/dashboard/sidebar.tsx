import {
  Activity,
  BookOpen,
  Settings,
  Shield,
  Users,
  Webhook
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", icon: Activity, label: "Overview" },
  { href: "/getting-started", icon: BookOpen, label: "Getting started" },
  { href: "/traces", icon: Activity, label: "Traces" },
  { href: "/policies", icon: Shield, label: "Policies" },
  { href: "/webhooks", icon: Webhook, label: "Webhooks" },
  { href: "/team", icon: Users, label: "Team" },
  { href: "/settings", icon: Settings, label: "Settings" }
] as const;

function BrandMark() {
  return (
    <svg aria-hidden="true" className="brand-mark" viewBox="0 0 36 36">
      <path
        d="M18 2 31.9 10v16L18 34 4.1 26V10L18 2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
      <path
        d="m9 10 9 5 9-5M18 15v11"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
  );
}

export function DashboardSidebar({
  active,
  status
}: {
  readonly active: string;
  readonly status: ReactNode;
}) {
  return (
    <aside className="sidebar">
      <Link aria-label="Qusto overview" className="brand" href="/">
        <BrandMark /> <span>Qusto</span>
      </Link>
      <nav aria-label="Primary navigation" className="primary-nav">
        {navigation.map(({ href, icon: Icon, label }) => {
          const current = label === active;
          return (
            <Link
              aria-current={current ? "page" : undefined}
              aria-label={label}
              className={current ? "active" : undefined}
              href={href}
              key={label}
              title={label}
            >
              <Icon aria-hidden="true" /> <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="connection">{status}</div>
    </aside>
  );
}
