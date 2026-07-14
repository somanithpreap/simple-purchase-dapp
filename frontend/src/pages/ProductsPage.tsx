import { useEffect, useState } from "react";
import { listProducts, purchaseProduct, submitPurchaseTx } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Product } from "../api/types";
import { weiToEth } from "../utils/format";
import { ensureNetwork, getSigner } from "../web3/wallet";
import { getContractInfoCached, getMarketplaceContract } from "../web3/contract";

function isUserRejection(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "ACTION_REJECTED";
}

export default function ProductsPage() {
  const { user, token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  async function refresh() {
    setLoading(true);
    try {
      setProducts(await listProducts());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleBuy(productId: string) {
    if (!token) return;
    if (!user?.walletAddress) {
      setMessage("Connect a wallet before buying (see the nav bar).");
      return;
    }
    setMessage(null);
    const quantity = quantities[productId] ?? 1;
    try {
      const order = await purchaseProduct(token, productId, quantity);
      const { chainId } = await getContractInfoCached();
      await ensureNetwork(chainId);
      const signer = await getSigner();
      const contract = await getMarketplaceContract(signer);
      const totalPriceWei = BigInt(order.totalPriceWei);
      const tx = await contract.purchase!(order.id, order.sellerWalletAddress, totalPriceWei, {
        value: totalPriceWei,
      });
      setMessage("Transaction submitted, waiting for confirmation...");
      await submitPurchaseTx(token, order.id, tx.hash);
      setMessage("Purchase escrowed! Check My Orders to confirm delivery once it arrives.");
      await refresh();
    } catch (err) {
      if (isUserRejection(err)) {
        setMessage("Transaction rejected in wallet.");
      } else {
        setMessage(err instanceof Error ? err.message : "Purchase failed");
      }
    }
  }

  if (loading) return <p>Loading products...</p>;

  return (
    <div>
      <h1>Products</h1>
      {message && <p className="notice">{message}</p>}
      {products.length === 0 && <p className="muted">No products listed yet.</p>}
      <div className="grid">
        {products.map((p) => (
          <div className="card product-card" key={p.id}>
            {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="product-image" />}
            <h3>{p.name}</h3>
            <p className="muted">{p.description}</p>
            <p>
              <span className="price">{weiToEth(p.priceWei)} ETH</span>{" "}
              <span className="muted">&middot; {p.stockQty} in stock</span>
            </p>
            {user?.role === "CUSTOMER" && (
              <div className="buy-row">
                <input
                  type="number"
                  min={1}
                  max={p.stockQty}
                  value={quantities[p.id] ?? 1}
                  onChange={(e) =>
                    setQuantities((q) => ({ ...q, [p.id]: Number(e.target.value) }))
                  }
                />
                <button onClick={() => handleBuy(p.id)} disabled={p.stockQty === 0}>
                  Buy
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
