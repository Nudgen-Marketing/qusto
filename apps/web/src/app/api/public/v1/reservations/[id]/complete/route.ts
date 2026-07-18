import { getPublicApi } from "../../../../../../../server/runtime";
import {
  reservationLimiter,
  withRateLimit
} from "../../../../../../../server/public-rate-limit";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const { id } = await context.params;
  return withRateLimit(request, reservationLimiter, () =>
    getPublicApi().completeReservation(request, id)
  );
}
