import { getPublicApi } from "../../../../../../server/runtime";

export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return getPublicApi().events(request);
}
