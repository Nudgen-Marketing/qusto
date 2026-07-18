import { getPublicApi } from "../../../../../../server/runtime";
import {
  eventLimiter,
  withRateLimit
} from "../../../../../../server/public-rate-limit";

export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return withRateLimit(request, eventLimiter, () =>
    getPublicApi().events(request)
  );
}
