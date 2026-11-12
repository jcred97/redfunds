import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ViewTransition } from "react";
import SessionRefresh from "@/app/components/auth/SessionRefresh";
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
  title: "RedTally",
  description: "Track your expenses",
  icons: { icon: { url: "/branding/redtally-peso.svg", type: "image/svg+xml" } },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionRefresh />
        <ViewTransition update="page-fade">
          <div className="flex flex-1 flex-col">{children}</div>
        </ViewTransition>
      </body>
    </html>
  );
}
