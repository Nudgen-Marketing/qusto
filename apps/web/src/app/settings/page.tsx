import { AppFrame } from "../../components/dashboard/app-frame";
import { ApiKeyForm } from "../../components/dashboard/management-forms";
import { revokeApiKeyAction } from "../../server/dashboard-actions";
import {
  requireDashboardContext,
  getDashboardRepository
} from "../../server/dashboard-runtime";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { context } = await requireDashboardContext();
  const database = getDashboardRepository();
  const [keys, audit] = await Promise.all([
    database.listApiKeys(context.environmentId),
    database.listAudit(context.organizationId)
  ]);
  return (
    <AppFrame
      active="Settings"
      environment={context.environmentName}
      title="Project settings"
    >
      <div className="management-grid">
        <section className="management-card">
          <h2>
            {context.projectName} / {context.environmentName}
          </h2>
          <p>API keys are environment-scoped, hash-only, and shown once.</p>
          <ApiKeyForm />
          <div className="stack-list">
            {keys.map((key) => (
              <article key={key.id}>
                <strong>{key.name}</strong>
                <span
                  className={
                    key.revoked_at === null ? "status-allow" : "status-deny"
                  }
                >
                  {key.revoked_at === null ? "active" : "revoked"}
                </span>
                <small>
                  Created {key.created_at.toISOString()} · last used{" "}
                  {key.last_used_at?.toISOString() ?? "never"}
                </small>
                {key.revoked_at === null ? (
                  <form action={revokeApiKeyAction}>
                    <input type="hidden" name="keyId" value={key.id} />
                    <button>Revoke</button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
        <section className="management-card">
          <h2>Audit log</h2>
          <div className="stack-list">
            {audit.map((entry) => (
              <article key={entry.id}>
                <strong>{entry.action}</strong>
                <span>{entry.target_type}</span>
                <small>
                  {entry.actor ?? "system"} · {entry.occurred_at.toISOString()}
                </small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppFrame>
  );
}
