import { PaymentLinks } from "./PaymentLinks";
import { BankingInfo } from "./BankingInfo";
import { AdminPanel } from "./AdminPanel";
import { FeeEarnings } from "./FeeEarnings";

export const DashboardOverview = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage your payment links and track your earnings
        </p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentLinks />
        <BankingInfo />
      </div>
      
      <FeeEarnings />
      <AdminPanel />
    </div>
  );
};