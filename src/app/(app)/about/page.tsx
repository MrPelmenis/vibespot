import { InfoList, InfoPage, InfoSection } from "@/components/InfoPage";

export const metadata = {
  title: "About",
  description: "What CoolSpot is and how it works.",
};

export default function AboutPage() {
  return (
    <InfoPage
      title="About CoolSpot"
      subtitle="A community map of the places worth going — built by the people who find them."
    >
      <InfoSection title="What it is">
        <p>
          CoolSpot is a community map of interesting places. Anyone can drop a pin, describe a
          place, add photos or a video and tag it with a category. Everyone else can browse the
          map, filter, search, read starred reviews and find their next good spot.
        </p>
        <p>
          It&apos;s built by friends, for friends — a small, self-hosted project with no ads and no
          tracking. Signing in is optional: it&apos;s only needed to add spots, write reviews, follow
          people and save places.
        </p>
      </InfoSection>

      <InfoSection title="What you can do">
        <InfoList
          items={[
            <>
              <strong className="font-medium">Add a spot</strong> — drop a pin, describe the place,
              add photos or a video and tag up to three categories.
            </>,
            <>
              <strong className="font-medium">Discover</strong> — browse the map, filter by category
              or search by name, address, city, category and who added it.
            </>,
            <>
              <strong className="font-medium">Rate and review</strong> — give a spot stars, write a
              review with photos or video, and mark when you visited.
            </>,
            <>
              <strong className="font-medium">Follow and save</strong> — follow contributors, save
              spots for later and track where you&apos;ve been.
            </>,
          ]}
        />
      </InfoSection>

      <InfoSection title="How the community works">
        <p>
          Spots are owned by the community, not by any single person. The person who adds a spot can
          edit it, and everyone else can add reviews, photos and ratings that make it more useful.
          The leaderboard celebrates the people who contribute the most.
        </p>
      </InfoSection>

      <InfoSection title="Who runs it">
        <p>
          CoolSpot is a small independent project. There are no advertisers, no analytics trackers
          and no paywalls — just a map that gets better the more people share the places they love.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
