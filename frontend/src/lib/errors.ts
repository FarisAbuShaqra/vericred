// Turns raw ethers / RPC / wallet errors into short, human-readable messages.
// Never returns a raw JSON object or stack trace to the UI.

// Collect every human-readable string ethers may have tucked into an error,
// without ever stringifying the whole object.
function collectText(err: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();

  function walk(value: unknown, depth: number) {
    if (value == null || depth > 4 || seen.has(value)) return;
    if (typeof value === "string") {
      parts.push(value);
      return;
    }
    if (typeof value !== "object") return;
    seen.add(value);
    const o = value as Record<string, unknown>;
    // Known message-bearing fields across ethers v6 / EIP-1193 / JSON-RPC.
    for (const key of [
      "shortMessage",
      "message",
      "reason",
      "code",
      "errorName",
      "info",
      "error",
      "data",
      "cause",
    ]) {
      if (key in o) walk(o[key], depth + 1);
    }
  }

  walk(err, 0);
  return parts.join(" | ");
}

export function humanizeError(err: unknown): string {
  const text = collectText(err);
  const code = (err as { code?: unknown })?.code;

  // User declined in the wallet.
  if (
    code === "ACTION_REJECTED" ||
    code === 4001 ||
    /user rejected|user denied|rejected the request/i.test(text)
  ) {
    return "Transaction rejected in your wallet.";
  }

  // No wallet available.
  if (/metamask not found/i.test(text)) {
    return "MetaMask was not found. Please install MetaMask and try again.";
  }

  // Contract require() reasons (the deployed contract uses these strings).
  if (/hash already registered/i.test(text)) {
    return "This exact document is already registered on-chain.";
  }
  if (/certificateid already used/i.test(text)) {
    return "That certificate ID is already in use. Regenerate the certificate ID and try again.";
  }

  // Owner restriction (OpenZeppelin custom error or message).
  if (/ownableunauthorizedaccount|caller is not the owner|not the owner/i.test(text)) {
    return "Only the registered issuer account can issue credentials.";
  }

  // Gas price below the network minimum (Polygon Amoy tip-cap floor).
  if (
    /gas tip cap|max priority fee|tip cap below|gas price below|underpriced|fee cap less than|below minimum/i.test(
      text
    )
  ) {
    return "Network gas price is higher than expected, please retry.";
  }

  // Not enough MATIC to pay for gas.
  if (/insufficient funds|insufficient balance/i.test(text)) {
    return "The issuer account doesn't have enough MATIC to cover the network fee. Add test MATIC and retry.";
  }

  // Estimate failed without a decodable revert reason (often a transient
  // node/fee/balance condition on the public RPC).
  if (/missing revert data|call_exception|cannot estimate gas/i.test(text)) {
    return "The transaction could not be prepared. Make sure your wallet is on Polygon Amoy with enough MATIC, then retry.";
  }

  // Connectivity / RPC problems.
  if (
    /could not detect network|network error|server_error|timeout|failed to fetch|connection|econn|fetch failed|bad response|503|502|500/i.test(
      text
    )
  ) {
    return "Network error reaching Polygon Amoy. Check your connection and try again.";
  }

  // Wrong chain selected in the wallet.
  if (/unsupported chain|chain mismatch|wrong network|chainid/i.test(text)) {
    return "Your wallet is on the wrong network. Switch it to Polygon Amoy and retry.";
  }

  // Fallback: short, generic, never raw JSON.
  return "Something went wrong while processing the request. Please try again.";
}
