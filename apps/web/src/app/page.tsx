import { Dashboard } from "../components/dashboard/dashboard";
import { demoDashboardData } from "../components/dashboard/demo-data";

export default function HomePage() {
  return <Dashboard data={demoDashboardData} />;
}
