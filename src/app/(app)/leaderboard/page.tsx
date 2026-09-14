import Link from "next/link";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { avatarUrl } from "@/lib/avatar";
import { listLeaderboard } from "@/lib/spots";

export const metadata = {
  title: "Leaderboard",
  description: "CoolSpot's top contributors, ranked by spots posted and combined rating.",
};

export default async function LeaderboardPage() {
  const entries = await listLeaderboard();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-[22px] text-text">Leaderboard</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Top contributors — ranked by spots posted, then combined rating.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card className="p-5">
          <CardTitle>No contributors yet</CardTitle>
          <CardBody>Be the first to add a spot and top the board.</CardBody>
        </Card>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((entry, index) => (
            <li key={entry.userId}>
              <Link
                href={`/u/${encodeURIComponent(entry.nickname)}`}
                className="flex items-center gap-3 rounded-md border border-line bg-surface p-3 shadow-sm transition-colors hover:bg-surface-2"
              >
                <span className="w-6 shrink-0 text-center font-heading text-[15px] text-muted">
                  {index + 1}
                </span>
                {avatarUrl(entry.avatarPath) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl(entry.avatarPath)!}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint font-heading text-[13px] text-accent">
                    {entry.nickname.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-text">
                    {entry.nickname}
                  </span>
                  <span className="block text-[12px] text-muted">
                    {entry.spotCount} {entry.spotCount === 1 ? "spot" : "spots"}
                    {entry.avgRating ? ` · ★ ${Number(entry.avgRating).toFixed(1)}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
