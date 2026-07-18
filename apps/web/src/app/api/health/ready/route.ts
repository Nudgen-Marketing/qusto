import { databaseReady } from "../../../../server/runtime";

export async function GET(): Promise<Response> {
  try {
    const ready = await databaseReady();
    return Response.json(
      { ok: ready, status: ready ? "ready" : "not_ready" },
      { status: ready ? 200 : 503 }
    );
  } catch {
    return Response.json({ ok: false, status: "not_ready" }, { status: 503 });
  }
}
