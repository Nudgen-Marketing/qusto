import { AppFrame } from "../../components/dashboard/app-frame";
import { InvitationForm } from "../../components/dashboard/management-forms";
import {
  requireDashboardContext,
  getDashboardRepository
} from "../../server/dashboard-runtime";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { context } = await requireDashboardContext();
  const team = await getDashboardRepository().listTeam(context.organizationId);
  return (
    <AppFrame
      active="Team"
      environment={context.environmentName}
      title="Team and access"
    >
      <div className="management-grid">
        <section className="management-card">
          <h2>Members</h2>
          <p>Deployment-wide roles are enforced on every management action.</p>
          <div className="stack-list">
            {team.map((member) => (
              <article key={member.email}>
                <strong>{member.name || member.email}</strong>
                <span className="pill">{member.role}</span>
                <small>{member.email}</small>
              </article>
            ))}
          </div>
        </section>
        <section className="management-card">
          <h2>Invite member</h2>
          <p>
            Invitation tokens expire after seven days and can be accepted only
            once.
          </p>
          <InvitationForm />
        </section>
      </div>
    </AppFrame>
  );
}
