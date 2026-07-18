import { AppFrame } from "../../components/dashboard/app-frame";
import { GettingStartedGuide } from "../../components/getting-started/getting-started-guide";
import { requireDashboardContext } from "../../server/dashboard-runtime";

export const dynamic = "force-dynamic";

export default async function GettingStartedPage() {
  const databaseUrl = process.env.DATABASE_URL;
  const environment =
    databaseUrl === undefined || databaseUrl.length === 0
      ? "Production"
      : (await requireDashboardContext()).context.environmentName;

  return (
    <AppFrame
      active="Getting started"
      environment={environment}
      title="Getting started"
    >
      <GettingStartedGuide />
    </AppFrame>
  );
}
