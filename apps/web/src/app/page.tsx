import { Dashboard } from "../components/dashboard/dashboard";
import { demoDashboardData } from "../components/dashboard/demo-data";
import { getAuth } from "../server/auth";
import { getDashboardRepository } from "../server/dashboard-runtime";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (process.env.DATABASE_URL === undefined) {
    return <Dashboard data={demoDashboardData} />;
  }
  const database = getDashboardRepository();
  if ((await database.userCount()) === 0) redirect("/onboarding");
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session === null) redirect("/login");
  const context = await database.contextForUser(session.user.id);
  if (context === undefined) throw new Error("No organization membership");
  return <Dashboard data={await database.overview(context)} />;
}
