import { describe, expect, it } from "vitest";

import {
  authorizeRegistration,
  completeRegistration,
  type RegistrationAuthorization,
  type RegistrationRepository
} from "../src/registration.js";

class MemoryRegistrationRepository implements RegistrationRepository {
  accepted = false;
  bootstrapped = false;
  users = 0;

  async acceptInvitation(): Promise<void> {
    this.accepted = true;
  }

  async bootstrap(): Promise<void> {
    this.bootstrapped = true;
  }

  async countUsers(): Promise<number> {
    return this.users;
  }

  async findInvitation(email: string, tokenHash: string) {
    return email === "dev@example.com" && tokenHash.length === 64
      ? { id: "invite-1", organizationId: "org-1", role: "developer" as const }
      : undefined;
  }
}

describe("registration gate", () => {
  it("allows only the first account to bootstrap the deployment", async () => {
    const repository = new MemoryRegistrationRepository();
    const authorization = await authorizeRegistration(
      "admin@example.com",
      undefined,
      repository
    );
    await completeRegistration(
      authorization,
      { email: "admin@example.com", id: "user-1" },
      repository
    );

    expect(authorization.mode).toBe("bootstrap");
    expect(repository.bootstrapped).toBe(true);
  });

  it("requires a valid one-time invitation after bootstrap", async () => {
    const repository = new MemoryRegistrationRepository();
    repository.users = 1;

    await expect(
      authorizeRegistration("unknown@example.com", undefined, repository)
    ).rejects.toThrow("Registration is closed");
    const authorization = await authorizeRegistration(
      "dev@example.com",
      "invitation-secret",
      repository
    );
    await completeRegistration(
      authorization,
      { email: "dev@example.com", id: "user-2" },
      repository
    );
    expect(repository.accepted).toBe(true);
  });

  it("rejects completion when the signed-up email differs", async () => {
    const repository = new MemoryRegistrationRepository();
    const authorization: RegistrationAuthorization = {
      email: "admin@example.com",
      mode: "bootstrap"
    };

    await expect(
      completeRegistration(
        authorization,
        { email: "attacker@example.com", id: "user-1" },
        repository
      )
    ).rejects.toThrow("Registration identity mismatch");
  });
});
