"use client";

import { useState } from "react";
import Seal from "./Seal";
import IssueForm from "./IssueForm";
import VerifyForm from "./VerifyForm";
import { isConfigured, CONTRACT_ADDRESS } from "@/lib/contract";

type Tab = "issue" | "verify";

export default function RegistryApp({
  initialTab = "verify",
  initialVerifyId = "",
}: {
  initialTab?: Tab;
  initialVerifyId?: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const configured = isConfigured();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-accent-700/15 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-6">
          <Seal />
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-accent-900">
              VeriCred
            </h1>
            <p className="text-xs uppercase tracking-[0.18em] text-accent-700/70">
              Blockchain Academic Credential Verification
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="mb-8 max-w-2xl text-sm leading-relaxed text-ink/70">
          VeriCred proves a credential was issued by this registered issuer
          address and has not been altered since registration. It does{" "}
          <span className="font-semibold">not</span> verify the issuer&apos;s
          real-world legitimacy, and no personal data is ever stored on-chain.
        </p>

        {!configured && (
          <div className="mb-8 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong className="font-semibold">No contract configured.</strong>{" "}
            Deploy first with{" "}
            <code className="font-mono text-xs">
              npx hardhat run scripts/deploy.js --network localhost
            </code>
            . The deploy step writes the address and ABI into this app.
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 flex gap-8 border-b border-accent-700/15">
          <TabButton active={tab === "verify"} onClick={() => setTab("verify")}>
            Verify
          </TabButton>
          <TabButton active={tab === "issue"} onClick={() => setTab("issue")}>
            Issue
          </TabButton>
        </div>

        {tab === "verify" ? (
          <VerifyForm initialId={initialVerifyId} />
        ) : (
          <IssueForm />
        )}

        <footer className="mt-12 border-t border-accent-700/10 pt-4 text-xs text-ink/40">
          {configured ? (
            <span>
              Registry contract:{" "}
              <span className="font-mono">{CONTRACT_ADDRESS}</span>
            </span>
          ) : (
            <span>Local Hardhat network · contract not yet deployed</span>
          )}
        </footer>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-1 pb-3 font-serif text-lg transition ${
        active
          ? "border-accent-700 text-accent-900"
          : "border-transparent text-ink/40 hover:text-ink/70"
      }`}
    >
      {children}
    </button>
  );
}
