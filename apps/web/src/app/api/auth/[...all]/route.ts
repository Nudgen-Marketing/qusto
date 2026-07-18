import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "../../../../server/auth";

export function GET(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).GET(request);
}

export function POST(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).POST(request);
}
