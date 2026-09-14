import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, Footprints, LogOut, MapPin, Settings, Star } from "lucide-react";
import { FollowButton } from "@/components/FollowButton";
import { FooterLinks } from "@/components/FooterLinks";
import { ProfileSettings } from "@/components/ProfileSettings";
import { SpotList } from "@/components/SpotList";
import { StarRating } from "@/components/StarRating";
import { avatarUrl } from "@/lib/avatar";
import { listReviewsByUser } from "@/lib/reviews";
import { getSession } from "@/lib/session";
import { getUserStats, isFollowing, isFriend, listFollowers, listFollowing, type FollowUser } from "@/lib/social";
import { listSavedSpots, listSpotsByCreator, listVisitedSpots } from "@/lib/spots";
import { getUserByNickname } from "@/lib/users";

type Props = { params: Promise<{ nickname: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nickname } = await params;
  const user = await getUserByNickname(nickname);
  if (!user) return { title: "Profile not found" };
  return {
    title: user.nickname,
    description: user.description ?? `${user.nickname} on CoolSpot.`,
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: Props & { searchParams: Promise<{ tab?: string }> }) {
  const { nickname } = await params;
  const { tab } = await searchParams;
  const user = await getUserByNickname(nickname);
  if (!user) notFound();

  const session = await getSession();
  const viewerId = session?.userId ? Number(session.userId) : null;
  const isOwn = viewerId === user.id;
  const avatar = avatarUrl(user.avatarPath);

  const [stats, following, friend, spots, reviews, saved, visited, followers, followingUsers] =
    await Promise.all([
      getUserStats(user.id),
      viewerId && !isOwn ? isFollowing(viewerId, user.id) : Promise.resolve(false),
      viewerId && !isOwn ? isFriend(viewerId, user.id) : Promise.resolve(false),
      listSpotsByCreator(user.id),
      listReviewsByUser(user.id),
      isOwn && viewerId ? listSavedSpots(viewerId) : Promise.resolve([]),
      isOwn && viewerId ? listVisitedSpots(viewerId) : Promise.resolve([]),
      listFollowers(user.id),
      listFollowing(user.id),
    ]);

  const tabs = [
    { id: "spots", label: "Spots", count: stats.spotCount, icon: MapPin },
    { id: "reviews", label: "Reviews", count: stats.reviewCount, icon: Star },
    ...(isOwn
      ? [
          { id: "saved", label: "Saved", count: saved.length, icon: Bookmark },
          { id: "visited", label: "Visited", count: visited.length, icon: Footprints },
        ]
      : []),
  ];
  const validTabs = new Set(["spots", "reviews", "followers", "following"]);
  if (isOwn) ["saved", "visited", "edit"].forEach((id) => validTabs.add(id));
  const activeTab = tab && validTabs.has(tab) ? tab : "spots";
  const base = `/u/${encodeURIComponent(user.nickname)}`;

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={`${user.nickname}'s avatar`}
            width={72}
            height={72}
            className="h-[72px] w-[72px] shrink-0 rounded-full border border-line object-cover"
          />
        ) : (
          <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-accent-tint font-heading text-[26px] text-accent">
            {user.nickname.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-[22px] text-text">{user.nickname}</h1>
          {user.description ? (
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted">{user.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
            <Link href={`${base}?tab=spots`} scroll={false} className="transition-colors hover:text-text">
              <span className="font-medium text-text">{stats.spotCount}</span>{" "}
              {stats.spotCount === 1 ? "spot" : "spots"}
            </Link>
            <Link href={`${base}?tab=reviews`} scroll={false} className="transition-colors hover:text-text">
              <span className="font-medium text-text">{stats.reviewCount}</span>{" "}
              {stats.reviewCount === 1 ? "review" : "reviews"}
            </Link>
            {isOwn ? (
              <Link href={`${base}?tab=visited`} scroll={false} className="transition-colors hover:text-text">
                <span className="font-medium text-text">{stats.visitedCount}</span> visited
              </Link>
            ) : (
              <span>
                <span className="font-medium text-text">{stats.visitedCount}</span> visited
              </span>
            )}
            <Link href={`${base}?tab=followers`} scroll={false} className="transition-colors hover:text-text">
              <span className="font-medium text-text">{stats.followerCount}</span>{" "}
              {stats.followerCount === 1 ? "follower" : "followers"}
            </Link>
            <Link href={`${base}?tab=following`} scroll={false} className="transition-colors hover:text-text">
              <span className="font-medium text-text">{stats.followingCount}</span> following
            </Link>
          </div>
        </div>
        {isOwn ? (
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href={`${base}?tab=edit`}
              aria-label="Edit profile"
              title="Edit profile"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <Settings size={18} strokeWidth={2.75} aria-hidden="true" />
            </Link>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                aria-label="Log out"
                title="Log out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <LogOut size={18} strokeWidth={2.75} aria-hidden="true" />
              </button>
            </form>
          </div>
        ) : (
          <FollowButton
            userId={user.id}
            initialFollowing={following}
            isFriend={friend}
            isOwn={isOwn}
          />
        )}
      </header>

      {/* Instagram-style tabs */}
      <nav aria-label="Profile sections" className="flex border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.id === "spots" ? base : `${base}?tab=${t.id}`}
            scroll={false}
            aria-current={activeTab === t.id ? "page" : undefined}
            className={[
              "flex flex-1 flex-col items-center gap-0.5 border-b-2 px-2 py-2 text-[12px] font-medium transition-colors",
              activeTab === t.id
                ? "border-accent text-text"
                : "border-transparent text-muted hover:text-text",
            ].join(" ")}
          >
            <t.icon size={16} strokeWidth={2.75} aria-hidden="true" />
            <span>{t.label}</span>
            <span className="text-[10px] leading-none text-faint">{t.count}</span>
          </Link>
        ))}
      </nav>

      {activeTab === "spots" ? (
        <SpotList spots={spots} empty="No spots yet." />
      ) : activeTab === "reviews" ? (
        reviews.length === 0 ? (
          <p className="rounded-md border border-line bg-surface p-4 text-[13px] text-muted">
            No reviews yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-md border border-line bg-surface p-3 text-[13px]">
                <div className="flex items-center gap-2">
                  <StarRating value={review.rating} size={12} />
                  <Link
                    href={`/spot/${review.spotSlug}`}
                    className="font-medium text-text transition-colors hover:text-accent"
                  >
                    {review.spotName}
                  </Link>
                </div>
                {review.body ? (
                  <p className="mt-1 whitespace-pre-wrap text-muted">{review.body}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : activeTab === "saved" ? (
        <SpotList spots={saved} empty="Nothing saved yet — tap Save on a spot you want to visit." />
      ) : activeTab === "visited" ? (
        <SpotList spots={visited} empty="No visits yet — mark a spot as visited on its page." />
      ) : activeTab === "followers" ? (
        <FollowList users={followers} empty="No followers yet." />
      ) : activeTab === "following" ? (
        <FollowList users={followingUsers} empty="Not following anyone yet." />
      ) : (
        <ProfileSettings
          initialDescription={user.description}
          avatarPath={user.avatarPath}
          nickname={user.nickname}
        />
      )}

      <FooterLinks />
    </div>
  );
}

function FollowList({ users, empty }: { users: FollowUser[]; empty: string }) {
  if (users.length === 0) {
    return (
      <p className="rounded-md border border-line bg-surface p-4 text-[13px] text-muted">{empty}</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {users.map((u) => (
        <li key={u.id}>
          <Link
            href={`/u/${encodeURIComponent(u.nickname)}`}
            className="flex items-center gap-3 rounded-md border border-line bg-surface p-3 transition-colors hover:bg-surface-2"
          >
            {avatarUrl(u.avatarPath) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl(u.avatarPath)!}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint font-heading text-[13px] text-accent">
                {u.nickname.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-[13px] font-medium text-text">{u.nickname}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
