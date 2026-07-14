import { useEffect, useState, type FormEvent } from "react";
import { createProduct, listProducts, listSellerOrders, updateStock } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Order, Product } from "../api/types";
import { ethToWei, weiToEth } from "../utils/format";

export default function SellerDashboardPage() {
  const { user, token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [priceEth, setPriceEth] = useState("");
  const [stockQty, setStockQty] = useState(1);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!token || !user) return;
    const [allProducts, sellerOrders] = await Promise.all([
      listProducts(),
      listSellerOrders(token),
    ]);
    setProducts(allProducts.filter((p) => p.sellerId === user.id));
    setOrders(sellerOrders);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      await createProduct(token, {
        name,
        description,
        imageUrl: imageUrl || undefined,
        priceWei: ethToWei(priceEth),
        stockQty,
      });
      setName("");
      setDescription("");
      setImageUrl("");
      setPriceEth("");
      setStockQty(1);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    }
  }

  async function handleStockChange(productId: string, newStock: number) {
    if (!token) return;
    await updateStock(token, productId, newStock);
    await refresh();
  }

  return (
    <div>
      <h1>Seller dashboard</h1>

      <section className="card">
        <h2>List a new product</h2>
        <form onSubmit={handleCreate}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} required />
          </label>
          <label>
            Image URL
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </label>
          <label>
            Price (ETH)
            <input
              type="number"
              step="0.0001"
              min="0"
              value={priceEth}
              onChange={(e) => setPriceEth(e.target.value)}
              required
            />
          </label>
          <label>
            Stock
            <input
              type="number"
              min={0}
              value={stockQty}
              onChange={(e) => setStockQty(Number(e.target.value))}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit">List product</button>
        </form>
      </section>

      <section>
        <h2>Your products</h2>
        {products.length === 0 && <p>You haven't listed any products yet.</p>}
        <div className="grid">
          {products.map((p) => (
            <div className="card" key={p.id}>
              {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="product-image" />}
              <h3>{p.name}</h3>
              <p>{weiToEth(p.priceWei)} ETH</p>
              <label>
                Stock
                <input
                  type="number"
                  min={0}
                  value={p.stockQty}
                  onChange={(e) => handleStockChange(p.id, Number(e.target.value))}
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Incoming orders</h2>
        {orders.length === 0 ? (
          <p>No orders yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Status</th>
                <th>Buyer</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>{o.product?.name}</td>
                  <td>{o.quantity}</td>
                  <td>{weiToEth(o.totalPriceWei)} ETH</td>
                  <td>{o.status}</td>
                  <td>{o.buyer?.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
