import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trace",
  description:
    "Real-time classroom access for blind and low-vision students. Trace watches the whiteboard, listens to the lecture, and gives the class back in a usable form.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-foreground focus:text-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-6xl items-baseline justify-between px-6 py-4">
            <Link
              href="/"
              className="font-mono text-sm font-semibold tracking-[0.2em] uppercase"
            >
              Trace
            </Link>
            <p className="font-mono text-xs tracking-wide text-muted uppercase">
              Classroom access, live
            </p>
          </div>
        </header>
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
