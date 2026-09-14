import { InfoList, InfoPage, InfoSection } from "@/components/InfoPage";

export const metadata = {
  title: "Terms of Service",
  description: "The terms for using CoolSpot.",
};

export default function TermsPage() {
  return (
    <InfoPage
      title="Terms of Service"
      subtitle="The short version of the rules for using CoolSpot."
      updated="2026"
    >
      <InfoSection title="Accepting these terms">
        <p>
          By using CoolSpot you agree to these terms. If you don&apos;t agree with them, please don&apos;t
          use the site.
        </p>
      </InfoSection>

      <InfoSection title="Your content">
        <p>
          You are responsible for the spots, reviews, photos and videos you post. When you add
          something, you agree that:
        </p>
        <InfoList
          items={[
            "It's your own content, or you have the right to share it.",
            "It isn't illegal, hateful, harassing, spammy or misleading.",
            "It can be shown publicly and edited or removed by an admin.",
          ]}
        />
      </InfoSection>

      <InfoSection title="Spots are community-owned">
        <p>
          Spots are places, not posts — they belong to the community. You can edit a spot you added,
          but only admins can delete one. Other people can add reviews, ratings and photos to any
          spot to make it more useful for everyone.
        </p>
      </InfoSection>

      <InfoSection title="Acceptable use">
        <p>
          Don&apos;t misuse the site: no automated scraping at scale, no impersonating others and no
          interfering with how the service works. Content that breaks these rules may be removed,
          and accounts that repeatedly abuse the site may be restricted.
        </p>
      </InfoSection>

      <InfoSection title="Availability">
        <p>
          The service is provided as-is, with no warranty. We may change, pause or remove features,
          and we&apos;re not liable for the content other people post.
        </p>
      </InfoSection>

      <InfoSection title="Changes to these terms">
        <p>
          We may update these terms from time to time. Continuing to use CoolSpot after a change
          means you accept the updated terms.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
