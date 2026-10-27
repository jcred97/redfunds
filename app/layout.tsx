import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ViewTransition } from "react";
import SessionRefresh from "@/app/components/SessionRefresh/SessionRefresh";
import { ExpenseGroupLoadingProvider } from "@/app/components/ExpenseGroupLoading/ExpenseGroupLoading";
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
  title: "RedFunds",
  description: "Track your expenses",
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
        <ViewTransition>
          <div className="flex flex-1 flex-col">
            <ExpenseGroupLoadingProvider>{children}</ExpenseGroupLoadingProvider>
          </div>
        </ViewTransition>
      </body>
    </html>
  );
}
