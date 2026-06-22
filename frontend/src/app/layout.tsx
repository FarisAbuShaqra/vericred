import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeriCred: Blockchain Academic Credential Verification",
  description:
    "Issue and verify academic credentials on-chain by document hash and certificate ID. No personal data stored on-chain.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
