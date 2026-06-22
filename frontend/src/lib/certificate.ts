// Certificate ID generation. Format: PREFIX-YYYY-XXXXXX
// e.g. "MIT-2026-7QK4ZP" or "UNIV-2026-7QK4ZP".
//
// The prefix is derived from the university name (initials of significant
// words). The 6-character suffix is drawn from an unambiguous alphabet using
// the browser CSPRNG, giving practical uniqueness. On-chain uniqueness is
// ultimately enforced by the contract, which reverts on a duplicate ID.

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L
const STOPWORDS = new Set(["OF", "THE", "AND", "FOR", "AT", "IN"]);

export function randomCode(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function derivePrefix(universityName: string): string {
  const cleaned = (universityName || "").toUpperCase().replace(/[^A-Z\s]/g, "");
  const words = cleaned.split(/\s+/).filter((w) => w && !STOPWORDS.has(w));

  let prefix = words.map((w) => w[0]).join("").slice(0, 4);
  if (prefix.length < 2) {
    prefix = cleaned.replace(/\s/g, "").slice(0, 4);
  }
  return prefix || "UNIV";
}

export function generateCertificateId(
  universityName: string,
  graduationDate: string
): string {
  // graduationDate is an ISO date string (YYYY-MM-DD) from the date picker.
  const year = (graduationDate || "").slice(0, 4) || String(new Date().getFullYear());
  return `${derivePrefix(universityName)}-${year}-${randomCode(6)}`;
}

export function verifyUrl(certificateId: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  return `${origin}/verify?id=${encodeURIComponent(certificateId)}`;
}
