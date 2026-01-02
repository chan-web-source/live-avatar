import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LiveAvatar Demo",
  description: "LiveAvatar Web SDK Demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-900 flex flex-col min-h-screen text-white justify-center items-center text-lg">
        {children}
      </body>
    </html>
  );
}
