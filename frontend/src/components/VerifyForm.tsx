"use client";

import { useEffect, useState, useCallback } from "react";
import FilePicker from "./FilePicker";
import { getReadContract, isConfigured } from "@/lib/contract";
import { formatTimestamp } from "@/lib/format";
import { humanizeError } from "@/lib/errors";

type HashResult =
  | { status: "verified"; certificateId: string; issuer: string; timestamp: bigint }
  | { status: "notfound" }
  | { status: "error"; message: string };

type IdResult =
  | { status: "found"; docHash: string; issuer: string; timestamp: bigint }
  | { status: "notfound" }
  | { status: "error"; message: string };

export default function VerifyForm({ initialId = "" }: { initialId?: string }) {
  return (
    <div className="space-y-8">
      <SectionIntro />
      <MethodA />
      <MethodB initialId={initialId} />
      <MethodCNote />
    </div>
  );
}

function SectionIntro() {
  return (
    <div>
      <h2 className="font-serif text-xl font-bold text-accent-900">
        Verify a credential
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/60">
        There are two tiers of trust. Uploading the PDF is the strong proof. It
        confirms the document itself is registered and unaltered. Looking up a
        certificate ID or scanning a QR only confirms that a record exists.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TierCard
          tier="Strong proof"
          label="Upload PDF"
          body="Re-hashes the file and matches it against the on-chain record. Proves the exact document is authentic and unaltered."
        />
        <TierCard
          tier="Record check"
          label="Certificate ID / QR"
          body="Confirms a record with that ID exists on-chain and who issued it, but not that any particular PDF matches it."
        />
      </div>
    </div>
  );
}

function TierCard({
  tier,
  label,
  body,
}: {
  tier: string;
  label: string;
  body: string;
}) {
  return (
    <div className="border border-ink/10 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-accent-700">
        {tier}
      </div>
      <div className="mt-0.5 font-serif text-base font-semibold text-accent-900">
        {label}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink/60">{body}</p>
    </div>
  );
}

/* ---------- Method A: upload PDF ---------- */

function MethodA() {
  const [hash, setHash] = useState<string | null>(null);
  const [result, setResult] = useState<HashResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleVerify() {
    if (!hash) return;
    setBusy(true);
    setResult(null);
    try {
      const contract = getReadContract();
      const [exists, certificateId, issuer, timestamp] =
        await contract.verifyByHash(hash);
      setResult(
        exists
          ? { status: "verified", certificateId, issuer, timestamp }
          : { status: "notfound" }
      );
    } catch (err) {
      setResult({ status: "error", message: humanizeError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeading badge="A">Upload the credential PDF</CardHeading>
      <p className="mb-4 text-sm text-ink/60">
        The file stays in your browser. Only its hash is sent to the contract.
      </p>

      <FilePicker
        label="Credential PDF"
        onHash={(h) => {
          setHash(h);
          setResult(null);
        }}
      />

      <button
        onClick={handleVerify}
        disabled={!hash || busy || !isConfigured()}
        className="mt-4 w-full bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Checking…" : "Verify document"}
      </button>

      {result?.status === "verified" && (
        <ResultBox tone="ok" title="VERIFIED">
          <p className="text-sm">
            This exact document is registered on-chain and has not been altered.
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Certificate ID" value={result.certificateId} mono />
            <Row label="Issuer" value={result.issuer} mono />
            <Row label="Registered" value={formatTimestamp(result.timestamp)} />
          </dl>
        </ResultBox>
      )}

      {result?.status === "notfound" && (
        <ResultBox tone="bad" title="NOT VERIFIED">
          <p className="text-sm">
            This file does not match any on-chain record. It may have been
            altered, or it was never registered.
          </p>
        </ResultBox>
      )}

      {result?.status === "error" && (
        <Note tone="error">Error: {result.message}</Note>
      )}
    </Card>
  );
}

/* ---------- Method B: certificate ID (auto-filled by QR deep link) ---------- */

function MethodB({ initialId }: { initialId: string }) {
  const [id, setId] = useState(initialId);
  const [result, setResult] = useState<IdResult | null>(null);
  const [busy, setBusy] = useState(false);

  const runLookup = useCallback(async (certId: string) => {
    const trimmed = certId.trim();
    if (!trimmed || !isConfigured()) return;
    setBusy(true);
    setResult(null);
    try {
      const contract = getReadContract();
      const [exists, docHash, issuer, timestamp] =
        await contract.verifyById(trimmed);
      setResult(
        exists
          ? { status: "found", docHash, issuer, timestamp }
          : { status: "notfound" }
      );
    } catch (err) {
      setResult({ status: "error", message: humanizeError(err) });
    } finally {
      setBusy(false);
    }
  }, []);

  // Auto-run when arriving via a QR deep link (/verify?id=...).
  useEffect(() => {
    if (initialId.trim()) {
      runLookup(initialId);
    }
  }, [initialId, runLookup]);

  return (
    <Card highlight={!!initialId.trim()}>
      <CardHeading badge="B">Look up by certificate ID</CardHeading>
      <p className="mb-4 text-sm text-ink/60">
        Enter a certificate ID (or arrive here by scanning a QR code).
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={id}
          placeholder="UNIV-2026-7QK4ZP"
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runLookup(id)}
          className="block w-full border border-ink/15 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-accent-700 focus:ring-1 focus:ring-accent-700"
        />
        <button
          onClick={() => runLookup(id)}
          disabled={!id.trim() || busy || !isConfigured()}
          className="shrink-0 bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Checking…" : "Look up"}
        </button>
      </div>

      {result?.status === "found" && (
        <ResultBox tone="record" title="RECORD FOUND">
          <p className="text-sm">
            A credential with this certificate ID exists on-chain, issued by{" "}
            <span className="font-mono text-xs">{result.issuer}</span> on{" "}
            {formatTimestamp(result.timestamp)}.
          </p>
          <Note tone="neutral">
            This confirms a record exists. To confirm the document itself is
            authentic, upload the PDF in <span className="font-semibold">Method
            A</span> above. An ID/QR lookup does not prove that any given PDF
            matches this record; only the document hash does.
          </Note>
        </ResultBox>
      )}

      {result?.status === "notfound" && (
        <ResultBox tone="bad" title="NO RECORD">
          <p className="text-sm">
            No credential with this certificate ID is registered on-chain.
          </p>
        </ResultBox>
      )}

      {result?.status === "error" && (
        <Note tone="error">Error: {result.message}</Note>
      )}
    </Card>
  );
}

/* ---------- Method C: scan QR (URL deep link) ---------- */

function MethodCNote() {
  return (
    <Card>
      <CardHeading badge="C">Scan a QR code</CardHeading>
      <p className="text-sm text-ink/60">
        A credential&apos;s QR code links to{" "}
        <span className="font-mono text-xs">/verify?id=CERTIFICATE_ID</span>.
        Scanning it with any phone camera opens this page and automatically runs
        the certificate ID lookup in Method B. Like any ID lookup, it confirms a
        record exists, not that a specific PDF matches it.
      </p>
    </Card>
  );
}

/* ---------- shared presentational helpers ---------- */

function Card({
  children,
  highlight,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border bg-white p-5 shadow-sm ${
        highlight ? "border-accent-700" : "border-ink/10"
      }`}
    >
      {children}
    </div>
  );
}

function CardHeading({
  badge,
  children,
}: {
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className="rule-accent mb-4 flex items-center gap-2 pb-2 font-serif text-base font-semibold text-accent-900">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-accent-700 text-xs font-bold text-accent-700">
        {badge}
      </span>
      {children}
    </h3>
  );
}

function ResultBox({
  tone,
  title,
  children,
}: {
  tone: "ok" | "bad" | "record";
  title: string;
  children: React.ReactNode;
}) {
  const palette = {
    ok: "border-emerald-600 text-emerald-800",
    bad: "border-red-500 text-red-800",
    record: "border-accent-700 text-accent-900",
  }[tone];
  return (
    <div className={`mt-4 border-l-2 bg-white px-4 py-3 ${palette}`}>
      <div className="font-serif text-lg font-bold">{title}</div>
      <div className="mt-1 text-ink/80">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-ink/40">{label}</dt>
      <dd className={`break-all text-ink/80 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function Note({
  tone,
  children,
}: {
  tone: "neutral" | "error";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-red-400 bg-red-50 text-red-800"
      : "border-ink/20 bg-ink/[0.03] text-ink/70";
  return (
    <div className={`mt-3 border-l-2 px-3 py-2 text-sm ${cls}`}>{children}</div>
  );
}
