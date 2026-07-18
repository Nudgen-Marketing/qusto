import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { LiveConnection } from "./live-connection";
import { DashboardSidebar } from "./sidebar";

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
      <DashboardSidebar
        active={active}
        status={
          <>
            <LiveConnection />
            <small>PostgreSQL + Base</small>
            <small>Worker monitored</small>
          </>
        }
      />
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
