import { getPublicApi } from "../../../../../../../server/runtime";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const { id } = await context.params;
  return getPublicApi().completeReservation(request, id);
}
