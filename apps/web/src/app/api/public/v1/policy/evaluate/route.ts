import { getPublicApi } from "../../../../../../server/runtime";
import {
  evaluationLimiter,
  withRateLimit
} from "../../../../../../server/public-rate-limit";

export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return withRateLimit(request, evaluationLimiter, () =>
    getPublicApi().evaluate(request)
  );
}
