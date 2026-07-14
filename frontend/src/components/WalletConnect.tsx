import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getWalletNonce, connectWallet } from "../api/client";
import { connectMetaMask, getSigner } from "../web3/wallet";

export default function WalletConnect() {
  const { user, token, login } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (!token || !user) return;
    setError(null);
    setConnecting(true);
    try {
      const address = await connectMetaMask();
      const { message } = await getWalletNonce(token);
      const signer = await getSigner();
      const signature = await signer.signMessage(message);
      const { walletAddress } = await connectWallet(token, address, signature);
      login({ ...user, walletAddress }, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <span>
      <button onClick={handleConnect} disabled={connecting}>
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <span className="error"> {error}</span>}
    </span>
  );
}
