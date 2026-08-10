import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "Earnival — commerce infrastructure for events",
    template: "%s · Earnival",
  },
  description:
    "Sell tickets, run vendor shops, take cashless payments and settle everyone — all from one event link.",
  openGraph: {
    type: "website",
    siteName: "Earnival",
  },
  applicationName: "Earnival",
  appleWebApp: { capable: true, title: "Earnival", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1C1030",
  width: "device-width",
  initialScale: 1,
  // Never block pinch-zoom: capping it is one of the most common mobile
  // accessibility failures, and this app is read outdoors at night.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="mx-auto min-h-screen max-w-md bg-paper shadow-2xl">
          {/* Single main landmark for the whole app; console routes widen
              themselves from inside via ConsoleShell. */}
          <main id="main">{children}</main>

          <footer className="border-t border-line px-4 py-6 text-center text-[12px] text-mute">
            <nav aria-label="Legal and support">
              <a href="/terms" className="underline underline-offset-2">
                Terms
              </a>
              <span aria-hidden> · </span>
              <a href="/privacy" className="underline underline-offset-2">
                Privacy
              </a>
              <span aria-hidden> · </span>
              <a href="/find" className="underline underline-offset-2">
                Find my ticket
              </a>
            </nav>
            <p className="mt-2">Earnival — commerce infrastructure for events.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
