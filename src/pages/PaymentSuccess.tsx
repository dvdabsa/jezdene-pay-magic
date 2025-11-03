import { Link, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const PaymentSuccess = () => {
  const query = useQuery();
  const amount = query.get("amount");
  const currency = (query.get("currency") || "USD").toUpperCase();

  return (
    <div className="flex items-center justify-center p-8">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <CardTitle>Payment successful</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Thank you! Your payment was received. Your balance will update shortly once the confirmation is processed.
          </p>
          {amount && (
            <p className="text-sm">Amount: <span className="font-medium">{currency} {Number(amount).toFixed(2)}</span></p>
          )}
          <div className="flex gap-3">
            <Link to="/dashboard/accounts"><Button>View Accounts</Button></Link>
            <Link to="/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;


