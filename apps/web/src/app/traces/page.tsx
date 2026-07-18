import { AppFrame } from "../../components/dashboard/app-frame";
import {
  requireDashboardContext,
  getDashboardRepository
} from "../../server/dashboard-runtime";

export const dynamic = "force-dynamic";

export default async function TracesPage({
  searchParams
}: {
  readonly searchParams: Promise<{ q?: string; trace?: string }>;
}) {
  const { context } = await requireDashboardContext();
  const parameters = await searchParams;
  const traces = await getDashboardRepository().listTraces(
    context.environmentId,
    parameters.q
  );
  const selectedId = parameters.trace ?? traces[0]?.id;
  const detail =
    selectedId === undefined
      ? undefined
      : await getDashboardRepository().traceDetail(
          context.environmentId,
          selectedId
        );
  return (
    <AppFrame
      active="Traces"
      environment={context.environmentName}
      title="Payment traces"
    >
      <section className="management-toolbar">
        <div>
          <h2>Instrumented x402 activity</h2>
          <p>
            Buyer and seller lifecycle events correlated into one payment
            attempt.
          </p>
        </div>
        <form>
          <input
            aria-label="Search traces"
            name="q"
            defaultValue={parameters.q}
            placeholder="Trace, payer, URL, transaction…"
          />
          <button>Search</button>
        </form>
      </section>
      <div className="management-split">
        <section className="management-card table-card">
          <table>
            <thead>
              <tr>
                <th>Outcome</th>
                <th>Resource</th>
                <th>Amount</th>
                <th>Network</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((trace) => (
                <tr
                  className={
                    trace.id === selectedId ? "selected-row" : undefined
                  }
                  key={trace.id}
                >
                  <td>
                    <a
                      href={`/traces?trace=${encodeURIComponent(trace.id)}`}
                      className={
                        trace.policy_outcome === "deny"
                          ? "status-deny"
                          : "status-allow"
                      }
                    >
                      {trace.policy_outcome ?? "pending"}
                    </a>
                  </td>
                  <td>{trace.resource_url ?? "—"}</td>
                  <td>{trace.amount_atomic ?? "—"}</td>
                  <td>{trace.network ?? "—"}</td>
                  <td>{trace.last_seen_at.toISOString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {traces.length === 0 ? (
            <p className="empty-state">No traces match this filter.</p>
          ) : null}
        </section>
        <aside className="management-card detail-card">
          <h3>Trace detail</h3>
          {detail?.trace === undefined ? (
            <p className="empty-state">
              Select a trace to inspect its lifecycle.
            </p>
          ) : (
            <>
              <dl className="key-values">
                <div>
                  <dt>ID</dt>
                  <dd>{detail.trace.id}</dd>
                </div>
                <div>
                  <dt>Payer</dt>
                  <dd>{detail.trace.payer ?? "—"}</dd>
                </div>
                <div>
                  <dt>Resource</dt>
                  <dd>{detail.trace.resource_url ?? "—"}</dd>
                </div>
              </dl>
              {detail.trace.transaction_hash === null ? null : (
                <a
                  className="text-link"
                  href={`https://basescan.org/tx/${encodeURIComponent(detail.trace.transaction_hash)}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  View on BaseScan ↗
                </a>
              )}
              <ol className="event-list">
                {detail.events.map((event, index) => (
                  <li key={`${event.event_type}-${String(index)}`}>
                    <span />
                    <div>
                      <strong>{event.event_type}</strong>
                      <time>{event.occurred_at.toISOString()}</time>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </aside>
      </div>
    </AppFrame>
  );
}
