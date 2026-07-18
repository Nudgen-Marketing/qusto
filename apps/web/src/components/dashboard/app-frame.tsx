import {
  Activity,
  ChevronDown,
  Settings,
  Shield,
  Users,
  Webhook
} from "lucide-react";
import type { ReactNode } from "react";
import { LiveConnection } from "./live-connection";

const navigation = [
  { href: "/", icon: Activity, label: "Overview" },
  { href: "/traces", icon: Activity, label: "Traces" },
  { href: "/policies", icon: Shield, label: "Policies" },
  { href: "/webhooks", icon: Webhook, label: "Webhooks" },
  { href: "/team", icon: Users, label: "Team" },
  { href: "/settings", icon: Settings, label: "Settings" }
] as const;

function Mark() {
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

export function AppFrame({
  active,
  children,
  environment = "Production",
  title
}: {
  readonly active: string;
  readonly children: ReactNode;
  readonly environment?: string;
  readonly title: string;
}) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <Mark /> <span>Qusto</span>
        </a>
        <nav className="primary-nav">
          {navigation.map(({ href, icon: Icon, label }) => (
            <a
              aria-label={label}
              className={label === active ? "active" : undefined}
              href={href}
              key={label}
            >
              <Icon /> <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="connection">
          <LiveConnection />
          <small>PostgreSQL + Base</small>
          <small>Worker monitored</small>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <h1>{title}</h1>
          <div>
            <span className="environment">
              {environment} <ChevronDown />
            </span>
          </div>
        </header>
        <div className="management-content">{children}</div>
      </section>
    </main>
  );
}
