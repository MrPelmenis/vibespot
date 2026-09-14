"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";

/** Follow / unfollow button. Mutual follow reads as "Friends". */
export function FollowButton({
  userId,
  initialFollowing,
  isFriend,
  isOwn,
}: {
  userId: number;
  initialFollowing: boolean;
  isFriend: boolean;
  isOwn: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);

  if (isOwn) return null;

  async function toggle() {
    const res = await fetch(`/api/users/${userId}/follow`, { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { following: boolean };
      setFollowing(data.following);
      router.refresh();
    } else if (res.status === 401) {
      router.push("/signin");
    }
  }

  const label = following ? (isFriend ? "Friends" : "Following") : "Follow";
  const Icon = following ? UserMinus : UserPlus;

  return (
    <button
      type="button"
      onClick={toggle}
      className={[
        "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors",
        following
          ? "border border-line-strong text-text hover:bg-surface-2"
          : "bg-accent text-accent-fg hover:bg-accent-hover",
      ].join(" ")}
    >
      <Icon size={15} strokeWidth={2.75} aria-hidden="true" />
      {label}
    </button>
  );
}
