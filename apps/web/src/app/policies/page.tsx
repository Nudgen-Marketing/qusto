import {
  evaluatePolicies,
  type PaymentContext,
  type PolicyRule
} from "@qusto/policy-engine";
import { AppFrame } from "../../components/dashboard/app-frame";
import { PolicyDraftForm } from "../../components/dashboard/management-forms";
import {
  publishPolicyAction,
  rollbackPolicyAction
} from "../../server/dashboard-actions";
import {
  requireDashboardContext,
  getDashboardRepository
} from "../../server/dashboard-runtime";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const { context } = await requireDashboardContext();
  const database = getDashboardRepository();
  const [versions, traces] = await Promise.all([
    database.listPolicyVersions(context.environmentId),
    database.listTraces(context.environmentId)
  ]);
  const recent = traces[0];
  return (
    <AppFrame
      active="Policies"
      environment={context.environmentName}
      title="Governance policies"
    >
      <div className="management-grid">
        <section className="management-card">
          <header>
            <div>
              <h2>Policy versions</h2>
              <p>
                Draft, publish, and rollback immutable environment policy sets.
              </p>
            </div>
          </header>
          <div className="version-list">
            {versions.map((version) => {
              const simulation =
                recent === undefined
                  ? undefined
                  : evaluatePolicies(
                      {
                        amountAtomic: recent.amount_atomic ?? "0",
                        asset:
                          "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                        network: recent.network ?? "eip155:8453",
                        payer: recent.payer ?? "unknown",
                        payee: "unknown",
                        phase: "buyer",
                        resourceUrl: recent.resource_url ?? "unknown"
                      } satisfies PaymentContext,
                      version.rules as PolicyRule[]
                    );
              return (
                <article key={version.id}>
                  <div>
                    <strong>Version {version.version}</strong>
                    <span className={`pill pill-${version.status}`}>
                      {version.status}
                    </span>
                    <small>
                      {version.published_at?.toISOString() ?? "Not published"}
                    </small>
                  </div>
                  <code>{JSON.stringify(version.rules, null, 2)}</code>
                  {simulation === undefined ? null : (
                    <p>
                      Recent trace simulation:{" "}
                      <b
                        className={
                          simulation.outcome === "deny"
                            ? "status-deny"
                            : "status-allow"
                        }
                      >
                        {simulation.outcome}
                      </b>{" "}
                      {simulation.reasonCodes.join(", ")}
                    </p>
                  )}
                  {version.status === "draft" ? (
                    <form action={publishPolicyAction}>
                      <input type="hidden" name="policyId" value={version.id} />
                      <button className="primary-button">Publish</button>
                    </form>
                  ) : (
                    <form action={rollbackPolicyAction}>
                      <input type="hidden" name="policyId" value={version.id} />
                      <button>Rollback to this version</button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        </section>
        <section className="management-card">
          <h2>New draft</h2>
          <p>
            Define max amounts, rolling budgets, and allow/deny lists. The
            latest trace is simulated against every saved version.
          </p>
          <PolicyDraftForm />
        </section>
      </div>
    </AppFrame>
  );
}
