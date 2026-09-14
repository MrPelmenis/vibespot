"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { avatarUrl } from "@/lib/avatar";

/** Own-profile editing + GDPR account settings (data export, delete account). */
export function ProfileSettings({
  initialDescription,
  avatarPath,
  nickname,
}: {
  initialDescription: string | null;
  avatarPath: string | null;
  nickname: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(nickname);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const avatar = avatarUrl(avatarPath);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: name, description }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; nickname?: string; error?: string };
    if (res.ok) {
      setSaved(true);
      if (data.nickname && data.nickname !== nickname) {
        router.replace(`/u/${encodeURIComponent(data.nickname)}?tab=edit`);
      }
      router.refresh();
    } else {
      setError(data.error ?? "Couldn't save.");
    }
    setSaving(false);
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("avatar", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
    if (res.ok) router.refresh();
    setUploading(false);
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4">
      <div>
        <h3 className="font-heading text-[15px] text-text">Display name</h3>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          className="mt-2 w-full rounded-full border border-line bg-surface-2 px-4 py-2 text-[14px] text-text placeholder:text-faint"
          placeholder="Your name"
        />
        <p className="mt-1 text-[12px] text-faint">2–40 characters. Changing it also changes your profile link.</p>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="font-heading text-[15px] text-text">Profile picture</h3>
        <div className="mt-2 flex items-center gap-3">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" width={56} height={56} className="h-14 w-14 rounded-full border border-line object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-tint font-heading text-[20px] text-accent">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[12px] text-text transition-colors hover:bg-surface-2">
            {uploading ? <Loader2 size={14} strokeWidth={2.75} className="animate-spin" aria-hidden="true" /> : null}
            Change picture
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={uploadAvatar}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="font-heading text-[15px] text-text">Description</h3>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[14px] text-text placeholder:text-faint"
          placeholder="Tell people about yourself…"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || name.trim().length < 2}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-45"
        >
          {saving ? <Loader2 size={14} strokeWidth={2.75} className="animate-spin" aria-hidden="true" /> : null}
          Save changes
        </button>
        {saved ? <span className="text-[12px] text-success">Saved.</span> : null}
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="font-heading text-[15px] text-text">Account</h3>
        <div className="mt-2 flex flex-col gap-2">
          <a
            href="/api/profile/export"
            className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline"
          >
            <Download size={14} strokeWidth={2.75} aria-hidden="true" />
            Download my data
          </a>
          <form
            action="/api/profile/delete"
            method="post"
            onSubmit={(event) => {
              if (!window.confirm("Delete your account? Your spots and reviews stay, but your identity is removed.")) {
                event.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-[13px] text-danger hover:underline"
            >
              <Trash2 size={14} strokeWidth={2.75} aria-hidden="true" />
              Delete my account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
