import { BrowserProvider, type Eip1193Provider } from "ethers";

type WalletProvider = Eip1193Provider & {
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

export class NoWalletError extends Error {
  constructor() {
    super("No Ethereum wallet found. Please install MetaMask.");
  }
}

function getEthereum(): WalletProvider {
  if (!window.ethereum) throw new NoWalletError();
  return window.ethereum;
}

export function isWalletAvailable(): boolean {
  return Boolean(window.ethereum);
}

export function getBrowserProvider(): BrowserProvider {
  return new BrowserProvider(getEthereum());
}

export async function connectMetaMask(): Promise<string> {
  const provider = getBrowserProvider();
  const accounts = (await provider.send("eth_requestAccounts", [])) as string[];
  const account = accounts[0];
  if (!account) throw new Error("No account returned by wallet");
  return account;
}

export async function getSigner() {
  return getBrowserProvider().getSigner();
}

function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

// Networks MetaMask doesn't know about out of the box and needs
// `wallet_addEthereumChain` for. Sepolia is already known to MetaMask, so
// only local Hardhat needs an entry here.
const ADDABLE_NETWORKS: Record<
  number,
  { chainName: string; rpcUrls: string[]; nativeCurrency: { name: string; symbol: string; decimals: number } }
> = {
  31337: {
    chainName: "Hardhat Local",
    rpcUrls: ["http://127.0.0.1:8545"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
};

export async function ensureNetwork(expectedChainId: number): Promise<void> {
  const ethereum = getEthereum();
  const network = await getBrowserProvider().getNetwork();
  if (Number(network.chainId) === expectedChainId) return;

  const hexChainId = toHexChainId(expectedChainId);
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] });
  } catch (err) {
    const addable = ADDABLE_NETWORKS[expectedChainId];
    if ((err as { code?: number }).code === 4902 && addable) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: hexChainId, ...addable }],
      });
    } else {
      throw err;
    }
  }
}

export function onAccountsChanged(handler: (accounts: string[]) => void): () => void {
  const ethereum = getEthereum();
  const listener = (...args: unknown[]) => handler(args[0] as string[]);
  ethereum.on?.("accountsChanged", listener);
  return () => ethereum.removeListener?.("accountsChanged", listener);
}

export function onChainChanged(handler: (chainId: string) => void): () => void {
  const ethereum = getEthereum();
  const listener = (...args: unknown[]) => handler(args[0] as string);
  ethereum.on?.("chainChanged", listener);
  return () => ethereum.removeListener?.("chainChanged", listener);
}
