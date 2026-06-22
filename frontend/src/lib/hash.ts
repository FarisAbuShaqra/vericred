/**
 * Compute the SHA-256 hash of a file's bytes in the browser using the
 * Web Crypto API, returned as a 0x-prefixed bytes32 hex string suitable for
 * passing to the contract.
 */
export async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  let hex = "0x";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}
