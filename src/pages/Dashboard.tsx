import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <DashboardHeader />
      <DashboardOverview />
    </div>
  );
};

export default Dashboard;