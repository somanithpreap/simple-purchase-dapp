import { useEffect, useState } from "react";
import { listProducts, purchaseProduct } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Product } from "../api/types";
import { weiToEth } from "../utils/format";

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
    setMessage(null);
    const quantity = quantities[productId] ?? 1;
    try {
      await purchaseProduct(token, productId, quantity);
      setMessage("Purchase escrowed! Check My Orders to confirm delivery once it arrives.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Purchase failed");
    }
  }

  if (loading) return <p>Loading products...</p>;

  return (
    <div>
      <h1>Products</h1>
      {message && <p className="notice">{message}</p>}
      {products.length === 0 && <p>No products listed yet.</p>}
      <div className="grid">
        {products.map((p) => (
          <div className="card" key={p.id}>
            {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="product-image" />}
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <p>
              <strong>{weiToEth(p.priceWei)} ETH</strong> &middot; {p.stockQty} in stock
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
