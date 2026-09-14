import { Card, CardBody, CardKicker, CardTitle, Tag } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Temporary placeholder for screens that arrive in a later phase. It is deliberately
 * explicit about what is coming rather than shipping lorem ipsum.
 */
export function Placeholder({
  kicker,
  title,
  description,
  phase,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  phase: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <CardKicker>{kicker}</CardKicker>
          <Tag tone="accent">{phase}</Tag>
        </div>
        <CardTitle className="mt-2 text-[22px]">{title}</CardTitle>
        <CardBody>{description}</CardBody>
        {children}
      </Card>

      <Card className="p-5">
        <CardTitle>What works right now</CardTitle>
        <CardBody>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            <li>Server-rendered pages with per-page metadata — not an empty JavaScript shell.</li>
            <li>Light and dark themes, with a toggle that also respects your OS setting.</li>
            <li>
              Bottom tabs on mobile, a sidebar on desktop — one information architecture for both.
            </li>
            <li>Google sign-in verified server-side; the session is an HttpOnly cookie.</li>
          </ul>
        </CardBody>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/signin" size="sm">
            Sign in with Google
          </ButtonLink>
          <ButtonLink href="/" variant="secondary" size="sm">
            Back home
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
