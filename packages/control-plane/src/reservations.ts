export interface Reservation {
  readonly amountAtomic: string;
  readonly asset: string;
  readonly environmentId: string;
  readonly expiresAt: string;
  readonly id: string;
  readonly payee: string;
  readonly payer: string;
  readonly status: "active" | "completed" | "expired" | "released";
  readonly traceId: string;
}

export interface ReservationCompletion {
  readonly settledAt: string;
  readonly transactionHash?: string;
}

export interface ReservationRepository {
  findForUpdate(id: string): Promise<Reservation | undefined>;
  insertLedger(
    reservation: Reservation,
    completion: ReservationCompletion
  ): Promise<void>;
  setStatus(id: string, status: Reservation["status"]): Promise<void>;
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}

function requireReservation(
  reservation: Reservation | undefined,
  environmentId: string
): Reservation {
  if (reservation?.environmentId !== environmentId) {
    throw new Error("Reservation not found");
  }
  return reservation;
}

export async function completeReservation(
  environmentId: string,
  reservationId: string,
  completion: ReservationCompletion,
  repository: ReservationRepository
): Promise<Reservation> {
  return repository.transaction(async () => {
    const reservation = requireReservation(
      await repository.findForUpdate(reservationId),
      environmentId
    );
    if (reservation.status === "completed") return reservation;
    if (reservation.status !== "active") {
      throw new Error("Reservation is not active");
    }
    await repository.insertLedger(reservation, completion);
    await repository.setStatus(reservation.id, "completed");
    return { ...reservation, status: "completed" };
  });
}

export async function releaseReservation(
  environmentId: string,
  reservationId: string,
  repository: ReservationRepository
): Promise<Reservation> {
  return repository.transaction(async () => {
    const reservation = requireReservation(
      await repository.findForUpdate(reservationId),
      environmentId
    );
    if (reservation.status === "released") return reservation;
    if (reservation.status !== "active") {
      throw new Error("Reservation is not active");
    }
    await repository.setStatus(reservation.id, "released");
    return { ...reservation, status: "released" };
  });
}
