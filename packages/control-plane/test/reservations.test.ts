import { describe, expect, it } from "vitest";

import {
  completeReservation,
  releaseReservation,
  type Reservation,
  type ReservationRepository
} from "../src/reservations.js";

class MemoryReservationRepository implements ReservationRepository {
  ledgerWrites = 0;
  reservation: Reservation = {
    amountAtomic: "25",
    asset: "0x0000000000000000000000000000000000000001",
    environmentId: "env-1",
    expiresAt: "2026-07-18T00:01:00.000Z",
    id: "res-1",
    payee: "0x0000000000000000000000000000000000000002",
    payer: "0x0000000000000000000000000000000000000003",
    status: "active",
    traceId: "trace-1"
  };

  async findForUpdate(): Promise<Reservation | undefined> {
    return this.reservation;
  }

  async insertLedger(): Promise<void> {
    this.ledgerWrites += 1;
  }

  async setStatus(_id: string, status: Reservation["status"]): Promise<void> {
    this.reservation = { ...this.reservation, status };
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}

describe("spend reservation lifecycle", () => {
  it("completes exactly once and records settled spend", async () => {
    const repository = new MemoryReservationRepository();
    const first = await completeReservation(
      "env-1",
      "res-1",
      { settledAt: "2026-07-18T00:00:30.000Z", transactionHash: "0xabc" },
      repository
    );
    const second = await completeReservation(
      "env-1",
      "res-1",
      { settledAt: "2026-07-18T00:00:30.000Z", transactionHash: "0xabc" },
      repository
    );

    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    expect(repository.ledgerWrites).toBe(1);
  });

  it("releases an active reservation idempotently", async () => {
    const repository = new MemoryReservationRepository();

    expect(
      (await releaseReservation("env-1", "res-1", repository)).status
    ).toBe("released");
    expect(
      (await releaseReservation("env-1", "res-1", repository)).status
    ).toBe("released");
  });

  it("does not allow one environment to operate on another environment reservation", async () => {
    const repository = new MemoryReservationRepository();

    await expect(
      releaseReservation("env-2", "res-1", repository)
    ).rejects.toThrow("Reservation not found");
  });
});
