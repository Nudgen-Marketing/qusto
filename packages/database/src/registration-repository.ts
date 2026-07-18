import postgres from "postgres";
import type {
  InvitationRegistration,
  RegisteredUser,
  RegistrationRepository
} from "@qusto/control-plane";

const environmentDefaults = [
  { failMode: "open", name: "development" },
  { failMode: "closed", name: "staging" },
  { failMode: "closed", name: "production" }
] as const;

export class PostgresRegistrationRepository implements RegistrationRepository {
  private readonly client: postgres.Sql;

  constructor(url: string) {
    this.client = postgres(url, { max: 5 });
  }

  async countUsers(): Promise<number> {
    const rows = await this.client<{ count: number }[]>`
      SELECT count(*)::integer AS count FROM users
    `;
    return rows[0]?.count ?? 0;
  }

  async findInvitation(
    email: string,
    tokenHash: string
  ): Promise<InvitationRegistration | undefined> {
    const rows = await this.client<
      {
        id: string;
        organization_id: string;
        role: InvitationRegistration["role"];
      }[]
    >`
      SELECT id, organization_id, role
      FROM invitations
      WHERE lower(email) = lower(${email})
        AND token_hash = ${tokenHash}
        AND accepted_at IS NULL
        AND expires_at > now()
      LIMIT 1
    `;
    const row = rows[0];
    return row === undefined
      ? undefined
      : { id: row.id, organizationId: row.organization_id, role: row.role };
  }

  async bootstrap(user: RegisteredUser): Promise<void> {
    await this.client.begin(async (sql) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended('qusto:bootstrap', 0))`;
      const existing = await sql<{ count: number }[]>`
        SELECT count(*)::integer AS count FROM organizations
      `;
      if ((existing[0]?.count ?? 0) > 0) {
        throw new Error("Deployment is already bootstrapped");
      }
      const [organization] = await sql<{ id: string }[]>`
        INSERT INTO organizations (name) VALUES ('Qusto') RETURNING id
      `;
      if (organization === undefined) throw new Error("Bootstrap failed");
      const [project] = await sql<{ id: string }[]>`
        INSERT INTO projects (organization_id, name, slug)
        VALUES (${organization.id}, 'Default', 'default') RETURNING id
      `;
      if (project === undefined) throw new Error("Bootstrap failed");

      await sql`
        INSERT INTO memberships (organization_id, user_id, role)
        VALUES (${organization.id}, ${user.id}, 'admin')
      `;
      for (const environment of environmentDefaults) {
        const [created] = await sql<{ id: string }[]>`
          INSERT INTO environments (project_id, name, fail_mode)
          VALUES (${project.id}, ${environment.name}, ${environment.failMode})
          RETURNING id
        `;
        if (created === undefined) throw new Error("Bootstrap failed");
        const [policy] = await sql<{ id: string }[]>`
          INSERT INTO policy_versions (
            environment_id, version, status, rules, published_at, published_by, created_by
          ) VALUES (
            ${created.id}, 1, 'published', '[]'::jsonb, now(), ${user.id}, ${user.id}
          ) RETURNING id
        `;
        if (policy === undefined) throw new Error("Bootstrap failed");
        await sql`
          UPDATE environments SET active_policy_version_id = ${policy.id}
          WHERE id = ${created.id}
        `;
      }
      await sql`
        INSERT INTO audit_entries (
          organization_id, actor_user_id, action, target_type, target_id
        ) VALUES (
          ${organization.id}, ${user.id}, 'deployment.bootstrapped',
          'organization', ${organization.id}
        )
      `;
    });
  }

  async acceptInvitation(
    invitation: InvitationRegistration,
    user: RegisteredUser
  ): Promise<void> {
    await this.client.begin(async (sql) => {
      const rows = await sql<
        {
          organization_id: string;
          role: InvitationRegistration["role"];
        }[]
      >`
        UPDATE invitations
        SET accepted_at = now(), accepted_by = ${user.id}
        WHERE id = ${invitation.id}
          AND organization_id = ${invitation.organizationId}
          AND lower(email) = lower(${user.email})
          AND accepted_at IS NULL
          AND expires_at > now()
        RETURNING organization_id, role
      `;
      const accepted = rows[0];
      if (accepted === undefined)
        throw new Error("Invitation is no longer valid");
      await sql`
        INSERT INTO memberships (organization_id, user_id, role)
        VALUES (${accepted.organization_id}, ${user.id}, ${accepted.role})
        ON CONFLICT (organization_id, user_id) DO NOTHING
      `;
      await sql`
        INSERT INTO audit_entries (
          organization_id, actor_user_id, action, target_type, target_id, metadata
        ) VALUES (
          ${accepted.organization_id}, ${user.id}, 'invitation.accepted',
          'invitation', ${invitation.id}, ${JSON.stringify({ email: user.email })}::jsonb
        )
      `;
    });
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
