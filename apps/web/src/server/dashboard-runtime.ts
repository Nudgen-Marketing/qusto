import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveBaseNetwork } from "@qusto/contracts";

import { getAuth } from "./auth";
import {
  PostgresDashboardRepository,
  type DashboardContext
} from "./dashboard-repository";

let repository: PostgresDashboardRepository | undefined;

export function getDashboardRepository(): PostgresDashboardRepository {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.length === 0)
    throw new Error("DATABASE_URL is required");
  repository ??= new PostgresDashboardRepository(
    url,
    resolveBaseNetwork(process.env.BASE_NETWORK)
  );
  return repository;
}

export async function requireDashboardContext(): Promise<{
  readonly context: DashboardContext;
  readonly userId: string;
}> {
  const database = getDashboardRepository();
  if ((await database.userCount()) === 0) redirect("/onboarding");
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session === null) redirect("/login");
  const context = await database.contextForUser(session.user.id);
  if (context === undefined)
    throw new Error("User has no Qusto organization membership");
  return { context, userId: session.user.id };
}
