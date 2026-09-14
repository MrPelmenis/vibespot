import { InfoList, InfoPage, InfoSection } from "@/components/InfoPage";

export const metadata = {
  title: "Privacy",
  description: "How CoolSpot handles your data.",
};

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy Policy"
      subtitle="CoolSpot is designed to collect as little about you as possible."
      updated="2026"
    >
      <InfoSection title="What we collect">
        <p>CoolSpot stores only two kinds of data:</p>
        <InfoList
          items={[
            <>
              <strong className="font-medium">Your identity</strong> — when you sign in with Google,
              we store only what Google attests to: your account subject id, display name and
              profile picture. We never store your password and never trust a name or email the
              browser supplies.
            </>,
            <>
              <strong className="font-medium">Your contributions</strong> — the spots, reviews,
              photos, videos and ratings you post. These are public.
            </>,
          ]}
        />
      </InfoSection>

      <InfoSection title="How we use it">
        <p>
          Your identity is used only to attribute your contributions and show your profile. We don&apos;t
          sell data, show ads or track you across the web.
        </p>
      </InfoSection>

      <InfoSection title="Cookies and sessions">
        <p>
          Signing in sets a single session cookie that keeps you logged in. Google may set its own
          cookies during the sign-in flow. We don&apos;t use analytics or advertising cookies.
        </p>
      </InfoSection>

      <InfoSection title="Your choices">
        <p>From your profile you can:</p>
        <InfoList
          items={[
            <>
              <strong className="font-medium">Download your data</strong> — export a copy of your
              profile and everything you&apos;ve posted.
            </>,
            <>
              <strong className="font-medium">Delete your account</strong> — which removes your
              identity from the site.
            </>,
            <>Sign out at any time.</>,
          ]}
        />
      </InfoSection>

      <InfoSection title="What happens when you delete your account">
        <p>
          Deleting your account removes your name, picture and link to your Google identity. Your
          spots and reviews stay on the map so the community knowledge survives, shown under a
          neutral &quot;former user&quot; label.
        </p>
      </InfoSection>

      <InfoSection title="Contact">
        <p>
          To report content or ask about your data, use the report button on the relevant spot or
          review.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
