import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import config from "@/contract/DiplomaRegistry.json";

export const CONTRACT_ADDRESS = config.address;
export const CONTRACT_ABI = config.abi;
export const RPC_URL = config.rpcUrl;
export const CHAIN_ID = config.chainId;

export function isConfigured(): boolean {
  return typeof CONTRACT_ADDRESS === "string" && CONTRACT_ADDRESS.length > 0;
}

/**
 * Read-only contract instance backed by the configured JSON-RPC endpoint.
 * Used by Verify mode (no wallet required). batchMaxCount:1 disables request
 * batching, which some public RPCs (e.g. the Amoy free tier) reject.
 */
export function getReadContract(): Contract {
  const provider = new JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: 1 });
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

/**
 * Connect MetaMask and return a signer-backed contract instance.
 * Used by Issue mode — requires a wallet and the owner account.
 */
export async function getWriteContract(): Promise<{
  contract: Contract;
  account: string;
}> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not found. Please install MetaMask.");
  }

  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

  return { contract, account };
}
