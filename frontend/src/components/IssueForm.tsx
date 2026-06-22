"use client";

import { useState } from "react";
import { parseUnits } from "ethers";
import QRCode from "qrcode";
import FilePicker from "./FilePicker";
import { getWriteContract, getReadContract, isConfigured } from "@/lib/contract";
import { generateCertificateId, verifyUrl } from "@/lib/certificate";
import { humanizeError } from "@/lib/errors";

interface Metadata {
  fullName: string;
  studentId: string;
  email: string;
  degree: string;
  university: string;
  graduationDate: string;
  honors: string;
}

const EMPTY: Metadata = {
  fullName: "",
  studentId: "",
  email: "",
  degree: "",
  university: "",
  graduationDate: "",
  honors: "",
};

type Status =
  | { state: "idle" }
  | { state: "pending"; message: string }
  | { state: "error"; message: string };

interface Success {
  certificateId: string;
  txHash: string;
  qrDataUrl: string;
  metadata: Metadata;
}

// Graduation-date bounds: nothing before 1950, nothing more than 6 years out.
const MIN_GRAD_DATE = "1950-01-01";
const MAX_GRAD_DATE = `${new Date().getFullYear() + 6}-12-31`;

export default function IssueForm() {
  const [meta, setMeta] = useState<Metadata>(EMPTY);
  const [hash, setHash] = useState<string | null>(null);
  const [certId, setCertId] = useState<string>("");
  const [account, setAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [success, setSuccess] = useState<Success | null>(null);
  const [dupWarning, setDupWarning] = useState(false);

  function update<K extends keyof Metadata>(key: K, value: string) {
    setMeta((m) => ({ ...m, [key]: value }));
  }

  // When a PDF is hashed, check the registry early so the issuer is warned
  // before spending a transaction on an already-registered document.
  async function handleHash(h: string | null) {
    setHash(h);
    setDupWarning(false);
    if (status.state === "error") setStatus({ state: "idle" });
    if (!h || !isConfigured()) return;
    try {
      const [exists] = await getReadContract().verifyByHash(h);
      setDupWarning(Boolean(exists));
    } catch {
      // Passive check; ignore network hiccups and let the send-time check decide.
    }
  }

  const requiredFilled =
    meta.fullName.trim() &&
    meta.studentId.trim() &&
    isEmail(meta.email) &&
    meta.degree.trim() &&
    meta.university.trim() &&
    meta.graduationDate.trim();

  const canGenerateId = meta.university.trim() && meta.graduationDate.trim();

  const canRegister =
    requiredFilled &&
    !!hash &&
    !!certId &&
    !dupWarning &&
    isConfigured() &&
    status.state !== "pending";

  function handleGenerateId() {
    setCertId(generateCertificateId(meta.university, meta.graduationDate));
  }

  async function handleConnect() {
    try {
      const { account } = await getWriteContract();
      setAccount(account);
      setStatus({ state: "idle" });
    } catch (err) {
      setStatus({ state: "error", message: humanizeError(err) });
    }
  }

  async function handleRegister() {
    if (!hash || !certId) return;
    setStatus({ state: "pending", message: "Checking the registry…" });
    try {
      // Pre-check: refuse early if this exact document is already registered,
      // instead of letting the transaction revert with a cryptic error.
      const [alreadyExists] = await getReadContract().verifyByHash(hash);
      if (alreadyExists) {
        setDupWarning(true);
        setStatus({
          state: "error",
          message:
            "This credential is already registered on-chain. Each document can only be registered once.",
        });
        return;
      }

      const { contract, account } = await getWriteContract();
      setAccount(account);

      // Owner pre-check: the public RPC returns the owner-restriction revert as
      // an undecodable custom error, so check ownership explicitly to give a
      // precise message instead of a generic "could not prepare" fallback.
      const owner: string = await contract.owner();
      if (owner.toLowerCase() !== account.toLowerCase()) {
        setStatus({
          state: "error",
          message: "Only the registered issuer account can issue credentials.",
        });
        return;
      }

      setStatus({ state: "pending", message: "Confirm the transaction in MetaMask…" });

      // Estimate gas WITHOUT fee fields. Including maxFeePerGas in the implicit
      // estimate makes Amoy's RPC run a balance pre-check (gasLimit ×
      // maxFeePerGas) that fails as "missing revert data" when the issuer's
      // MATIC is below that worst-case amount. Passing an explicit gasLimit
      // makes ethers skip that implicit estimate, so the 50 gwei ceiling only
      // applies to the actual send (which costs base + 30 gwei tip).
      const gasLimit = await contract.registerDiploma.estimateGas(hash, certId);

      const tx = await contract.registerDiploma(hash, certId, {
        maxPriorityFeePerGas: parseUnits("30", "gwei"),
        maxFeePerGas: parseUnits("50", "gwei"),
        gasLimit,
      });
      setStatus({ state: "pending", message: "Waiting for on-chain confirmation…" });
      await tx.wait();

      const qrDataUrl = await QRCode.toDataURL(verifyUrl(certId), {
        width: 320,
        margin: 1,
        color: { dark: "#122a49", light: "#ffffff" },
      });

      setSuccess({
        certificateId: certId,
        txHash: tx.hash,
        qrDataUrl,
        metadata: meta,
      });
      setStatus({ state: "idle" });
    } catch (err) {
      setStatus({ state: "error", message: humanizeError(err) });
    }
  }

  function handleReset() {
    setMeta(EMPTY);
    setHash(null);
    setCertId("");
    setSuccess(null);
    setDupWarning(false);
    setStatus({ state: "idle" });
  }

  if (success) {
    return <SuccessView success={success} onReset={handleReset} />;
  }

  return (
    <div className="space-y-8">
      <SectionIntro
        title="Issue a credential"
        body="Only the registered issuer (the contract owner account) can register a credential. The metadata below is printed for the student's records and lives in the PDF. It is never written on-chain. Only the document hash, certificate ID, issuer address, and timestamp are stored."
      />

      {/* Wallet */}
      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink/60">
            {account ? "Issuer wallet connected" : "Issuer wallet not connected"}
          </span>
          {account ? (
            <span className="font-mono text-xs text-ink/80">{account}</span>
          ) : (
            <button
              onClick={handleConnect}
              className="bg-accent-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-800"
            >
              Connect MetaMask
            </button>
          )}
        </div>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeading>Student metadata (off-chain)</CardHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Student full legal name" value={meta.fullName} onChange={(v) => update("fullName", v)} placeholder="Ada Lovelace" />
          <Field label="Student ID" value={meta.studentId} onChange={(v) => update("studentId", v)} placeholder="S1234567" />
          <Field label="Student school email" type="email" value={meta.email} onChange={(v) => update("email", v)} placeholder="ada@university.edu" />
          <Field label="University name" value={meta.university} onChange={(v) => update("university", v)} placeholder="Example State University" />
          <div className="sm:col-span-2">
            <Field label="Degree / credential" value={meta.degree} onChange={(v) => update("degree", v)} placeholder="Bachelor of Science in Computer Science" />
          </div>
          <Field label="Graduation date" type="date" value={meta.graduationDate} onChange={(v) => update("graduationDate", v)} min={MIN_GRAD_DATE} max={MAX_GRAD_DATE} />
          <Field label="Honors (optional)" value={meta.honors} onChange={(v) => update("honors", v)} placeholder="Magna Cum Laude" />
        </div>
        <Note tone="neutral">
          The uploaded PDF is the source of truth. These typed fields are
          descriptive metadata that the issuer is responsible for entering
          correctly. They are <span className="font-semibold">not</span> read
          from or cross-checked against the PDF&apos;s contents. Only the PDF
          file&apos;s hash is bound on-chain.
        </Note>
      </Card>

      {/* Document + certificate ID */}
      <Card>
        <CardHeading>Credential document &amp; certificate ID</CardHeading>
        <FilePicker label="Credential PDF" onHash={handleHash} />

        {dupWarning && (
          <Note tone="warning">
            This credential is already registered on-chain. Each document can
            only be registered once.
          </Note>
        )}

        <div className="mt-5">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink/60">
            Certificate ID
          </span>
          {certId ? (
            <div className="flex items-center justify-between border border-accent-700/30 bg-accent-50 px-3 py-2.5">
              <span className="font-mono text-sm font-semibold text-accent-900">{certId}</span>
              <button
                onClick={handleGenerateId}
                className="text-xs text-accent-700 underline hover:text-accent-900"
              >
                Regenerate
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateId}
              disabled={!canGenerateId}
              className="border border-accent-700 px-3 py-2 text-xs font-semibold text-accent-700 hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Generate certificate ID
            </button>
          )}
          {!canGenerateId && !certId && (
            <p className="mt-1 text-xs text-ink/40">
              Enter the university name and graduation date first.
            </p>
          )}
        </div>
      </Card>

      <button
        onClick={handleRegister}
        disabled={!canRegister}
        className="w-full bg-accent-700 px-4 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status.state === "pending" ? "Registering…" : "Register credential on-chain"}
      </button>

      {status.state === "pending" && <Note tone="neutral">{status.message}</Note>}
      {status.state === "error" && <Note tone="error">{status.message}</Note>}
    </div>
  );
}

function SuccessView({
  success,
  onReset,
}: {
  success: Success;
  onReset: () => void;
}) {
  const { certificateId, txHash, qrDataUrl, metadata } = success;

  return (
    <div className="space-y-8">
      <div className="border-l-2 border-accent-700 bg-accent-50 px-5 py-4">
        <h2 className="font-serif text-xl font-bold text-accent-900">
          Credential registered
        </h2>
        <p className="mt-1 text-sm text-ink/70">
          The document hash and certificate ID are now recorded on-chain.
        </p>
      </div>

      <Card>
        <CardHeading>Certificate</CardHeading>
        <dl className="space-y-2 text-sm">
          <Row label="Certificate ID" value={certificateId} mono />
          <Row label="Transaction" value={txHash} mono />
        </dl>
      </Card>

      <Card>
        <CardHeading>Verification QR code</CardHeading>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`Verification QR code for ${certificateId}`}
            className="h-44 w-44 border border-ink/10"
          />
          <div className="text-sm text-ink/70">
            <p>
              This QR code links to the verification page pre-filled with the
              certificate ID. Scanning it confirms a record exists. Full proof
              still requires uploading the PDF.
            </p>
            <a
              href={qrDataUrl}
              download={`${certificateId}.png`}
              className="mt-3 inline-block bg-accent-700 px-3 py-2 text-xs font-semibold text-white hover:bg-accent-800"
            >
              Download QR as PNG
            </a>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeading>Student record (off-chain)</CardHeading>
        <dl className="space-y-2 text-sm">
          <Row label="Name" value={metadata.fullName} />
          <Row label="Student ID" value={metadata.studentId} />
          <Row label="Email" value={metadata.email} />
          <Row label="Degree" value={metadata.degree} />
          <Row label="University" value={metadata.university} />
          <Row label="Graduation" value={metadata.graduationDate} />
          {metadata.honors.trim() && <Row label="Honors" value={metadata.honors} />}
        </dl>
        <Note tone="neutral">
          This metadata was <span className="font-semibold">not</span> written
          on-chain. It exists only in the PDF and here, for the student&apos;s
          records.
        </Note>
      </Card>

      <button
        onClick={onReset}
        className="w-full border border-accent-700 px-4 py-2.5 text-sm font-semibold text-accent-700 hover:bg-accent-50"
      >
        Issue another credential
      </button>
    </div>
  );
}

/* ---------- small presentational helpers ---------- */

function SectionIntro({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="font-serif text-xl font-bold text-accent-900">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/60">{body}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-ink/10 bg-white p-5 shadow-sm">{children}</div>;
}

function CardHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="rule-accent mb-4 pb-2 font-serif text-base font-semibold text-accent-900">
      {children}
    </h3>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink/60">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent-700 focus:ring-1 focus:ring-accent-700"
      />
    </label>
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
  tone: "neutral" | "error" | "warning";
  children: React.ReactNode;
}) {
  const cls = {
    error: "border-red-400 bg-red-50 text-red-800",
    warning: "border-amber-500 bg-amber-50 text-amber-900",
    neutral: "border-ink/20 bg-ink/[0.03] text-ink/70",
  }[tone];
  return (
    <div className={`mt-3 border-l-2 px-3 py-2 text-sm ${cls}`}>{children}</div>
  );
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
