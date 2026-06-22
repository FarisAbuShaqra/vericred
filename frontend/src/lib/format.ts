// Format an on-chain block timestamp (uint256 seconds, as bigint) for display.
export function formatTimestamp(timestamp: bigint): string {
  const ms = Number(timestamp) * 1000;
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
