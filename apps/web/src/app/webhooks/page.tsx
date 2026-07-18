import { AppFrame } from "../../components/dashboard/app-frame";
import { WebhookForm } from "../../components/dashboard/management-forms";
import { retryWebhookAction } from "../../server/dashboard-actions";
import {
  requireDashboardContext,
  getDashboardRepository
} from "../../server/dashboard-runtime";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const { context } = await requireDashboardContext();
  const database = getDashboardRepository();
  const [webhooks, deliveries] = await Promise.all([
    database.listWebhooks(context.environmentId),
    database.listWebhookDeliveries(context.environmentId)
  ]);
  return (
    <AppFrame
      active="Webhooks"
      environment={context.environmentName}
      title="Webhooks"
    >
      <div className="management-grid">
        <section className="management-card">
          <h2>Endpoints</h2>
          <p>Secrets are AES-256-GCM encrypted at rest and displayed once.</p>
          <WebhookForm />
          <div className="stack-list">
            {webhooks.map((webhook) => (
              <article key={webhook.id}>
                <strong>{webhook.url}</strong>
                <span
                  className={webhook.enabled ? "status-allow" : "status-deny"}
                >
                  {webhook.enabled ? "enabled" : "disabled"}
                </span>
                <small>{webhook.event_types.join(", ")}</small>
              </article>
            ))}
          </div>
        </section>
        <section className="management-card">
          <h2>Delivery history</h2>
          <div className="stack-list">
            {deliveries.map((delivery) => (
              <article key={delivery.id}>
                <strong>{delivery.event_type}</strong>
                <span>
                  {delivery.status_code ?? delivery.last_error ?? "pending"}
                </span>
                <small>
                  {delivery.url} · attempt {delivery.attempt}
                </small>
                {delivery.status_code === null ? (
                  <form action={retryWebhookAction}>
                    <input
                      type="hidden"
                      name="deliveryId"
                      value={delivery.id}
                    />
                    <button>Retry now</button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
          {deliveries.length === 0 ? (
            <p className="empty-state">No deliveries yet.</p>
          ) : null}
        </section>
      </div>
    </AppFrame>
  );
}
