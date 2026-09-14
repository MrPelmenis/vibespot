import { AdminPanel, type ReportRow, type RequestRow } from "@/components/admin/AdminPanel";
import { Card, CardBody, CardKicker, CardTitle } from "@/components/ui/Card";
import { listReports, listSpotRequests } from "@/lib/admin";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.userId) {
    return (
      <Card className="mx-auto mt-6 max-w-md p-6">
        <CardKicker>Admin</CardKicker>
        <CardTitle className="mt-2 text-[22px]">Sign in</CardTitle>
        <CardBody>Admins only.</CardBody>
      </Card>
    );
  }
  if (!session.isAdmin) {
    return (
      <Card className="mx-auto mt-6 max-w-md p-6">
        <CardKicker>Admin</CardKicker>
        <CardTitle className="mt-2 text-[22px]">Admins only</CardTitle>
        <CardBody>This area is restricted to admin accounts.</CardBody>
      </Card>
    );
  }

  const [reports, requests] = await Promise.all([listReports("open"), listSpotRequests("open")]);

  const reportRows: ReportRow[] = reports.map((r) => ({
    id: r.id,
    targetType: r.target_type,
    targetId: r.target_id,
    targetLabel: r.target_label,
    reason: r.reason,
    reporterNickname: r.reporter_nickname,
    createdAt: r.created_at.toISOString(),
  }));
  const requestRows: RequestRow[] = requests.map((r) => ({
    id: r.id,
    kind: r.kind,
    spotId: r.spot_id,
    spotName: r.spot_name,
    spotSlug: r.spot_slug,
    requesterNickname: r.requester_nickname,
    createdAt: r.created_at.toISOString(),
  }));

  return <AdminPanel reports={reportRows} requests={requestRows} />;
}
