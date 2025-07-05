import { getAllStreamGroups } from "@/lib/api";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppSidebar from "./_components/app-sidebar";
import QueryProvider from "./_components/query-provider";
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
  title: "Acestream Search by rhymecode",
};

export const revalidate = 43200;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const streamGroups = await getAllStreamGroups();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <AppSidebar streamGroups={streamGroups}>{children}</AppSidebar>
        </QueryProvider>
      </body>
    </html>
  );
}
