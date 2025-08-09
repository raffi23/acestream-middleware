import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import ClientProviders from "./_providers/client-providers";

// import { Geist, Geist_Mono } from "next/font/google";
// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "Acestream Search by rhymecode",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        //{geistSans.variable} ${geistMono.variable}
        className={`$antialiased`}
      >
        <div className="max-w-lg mx-auto mt-[calc(30vh_-_3.3125rem)]">
          <main className="p-4">
            <ClientProviders>{children}</ClientProviders>
          </main>
        </div>

        <Toaster />
      </body>
    </html>
  );
}
