"use client";

import { useState } from "react";
import { sha256File } from "@/lib/hash";

export default function FilePicker({
  label = "Credential PDF",
  onHash,
}: {
  label?: string;
  onHash: (hash: string | null, fileName: string | null) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) {
      setFileName(null);
      setHash(null);
      onHash(null, null);
      return;
    }
    setBusy(true);
    setFileName(file.name);
    try {
      const h = await sha256File(file);
      setHash(h);
      onHash(h, file.name);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink/60">
          {label}
        </span>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="block w-full cursor-pointer border border-ink/15 bg-white text-sm text-ink/70 file:mr-4 file:cursor-pointer file:border-0 file:bg-accent-700 file:px-4 file:py-2.5 file:font-medium file:text-white hover:file:bg-accent-800"
        />
      </label>

      {fileName && (
        <div className="mt-3 border border-ink/10 bg-white px-3 py-2.5 text-xs">
          <div className="text-ink/40">File</div>
          <div className="font-medium text-ink/80">{fileName}</div>
          <div className="mt-2 text-ink/40">SHA-256 document hash (bytes32)</div>
          <div className="break-all font-mono text-ink/80">
            {busy ? "Computing…" : hash}
          </div>
        </div>
      )}
    </div>
  );
}
