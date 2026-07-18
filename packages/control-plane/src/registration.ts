import { createHash } from "node:crypto";

export type MembershipRole = "admin" | "developer" | "viewer";

export interface InvitationRegistration {
  readonly id: string;
  readonly organizationId: string;
  readonly role: MembershipRole;
}

export type RegistrationAuthorization =
  | { readonly email: string; readonly mode: "bootstrap" }
  | {
      readonly email: string;
      readonly invitation: InvitationRegistration;
      readonly mode: "invitation";
    };

export interface RegisteredUser {
  readonly email: string;
  readonly id: string;
}

export interface RegistrationRepository {
  acceptInvitation(
    invitation: InvitationRegistration,
    user: RegisteredUser
  ): Promise<void>;
  bootstrap(user: RegisteredUser): Promise<void>;
  countUsers(): Promise<number>;
  findInvitation(
    email: string,
    tokenHash: string
  ): Promise<InvitationRegistration | undefined>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function authorizeRegistration(
  email: string,
  invitationToken: string | undefined,
  repository: RegistrationRepository
): Promise<RegistrationAuthorization> {
  const normalizedEmail = normalizeEmail(email);
  if ((await repository.countUsers()) === 0) {
    return { email: normalizedEmail, mode: "bootstrap" };
  }
  if (invitationToken === undefined || invitationToken.length < 16) {
    throw new Error("Registration is closed");
  }
  const invitation = await repository.findInvitation(
    normalizedEmail,
    hashInvitationToken(invitationToken)
  );
  if (invitation === undefined) throw new Error("Registration is closed");
  return { email: normalizedEmail, invitation, mode: "invitation" };
}

export async function completeRegistration(
  authorization: RegistrationAuthorization,
  user: RegisteredUser,
  repository: RegistrationRepository
): Promise<void> {
  if (normalizeEmail(user.email) !== authorization.email) {
    throw new Error("Registration identity mismatch");
  }
  if (authorization.mode === "bootstrap") {
    await repository.bootstrap(user);
    return;
  }
  await repository.acceptInvitation(authorization.invitation, user);
}
