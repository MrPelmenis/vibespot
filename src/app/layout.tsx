import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // Per-page titles override the template — spot pages must set their own.
  title: {
    default: "CoolSpot — find the best spots around you",
    template: "%s · CoolSpot",
  },
  description:
    "A community map of interesting places. Find a good spot near you, or anywhere, and see whether it is any good.",
  applicationName: "CoolSpot",
  icons: {
    icon: "/marker.png",
    shortcut: "/marker.png",
    apple: "/marker.png",
  },
  verification: {
    google: "EaUO1Pf1dXAcXZJsH3Nz5GolKelXCLX4aaXdIjW6JsU",
  },
  openGraph: {
    type: "website",
    siteName: "CoolSpot",
    title: "CoolSpot",
    description: "A community map of interesting places.",
    url: "https://coolspot.lv/",
  },
  metadataBase: new URL(process.env.SITE_URL ?? "https://coolspot.lv"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Tint the browser chrome to match the active theme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5ead8" },
    { media: "(prefers-color-scheme: dark)", color: "#202124" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Runs before paint so there is no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
