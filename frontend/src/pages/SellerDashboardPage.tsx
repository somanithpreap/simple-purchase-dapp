import { useEffect, useState, type FormEvent } from "react";
import {
  createProduct,
  deleteProduct,
  listProducts,
  listSellerOrders,
  updateProduct,
  updateStock,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Order, Product } from "../api/types";
import { ethToWei, weiToEth } from "../utils/format";
import Modal from "../components/Modal";

export default function SellerDashboardPage() {
  const { user, token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showListModal, setShowListModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [priceEth, setPriceEth] = useState("");
  const [stockQty, setStockQty] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [stockDrafts, setStockDrafts] = useState<Record<string, number>>({});
  const [savingStockId, setSavingStockId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editPriceEth, setEditPriceEth] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function refresh() {
    if (!token || !user) return;
    const [allProducts, sellerOrders] = await Promise.all([
      listProducts(),
      listSellerOrders(token),
    ]);
    setProducts(allProducts.filter((p) => p.sellerId === user.id));
    setOrders(sellerOrders);
    setStockDrafts({});
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function openListModal() {
    setName("");
    setDescription("");
    setImageUrl("");
    setPriceEth("");
    setStockQty(1);
    setCreateError(null);
    setShowListModal(true);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreateError(null);
    setCreating(true);
    try {
      await createProduct(token, {
        name,
        description,
        imageUrl: imageUrl || undefined,
        priceWei: ethToWei(priceEth),
        stockQty,
      });
      setShowListModal(false);
      await refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setCreating(false);
    }
  }

  async function handleStockSubmit(e: FormEvent, product: Product) {
    e.preventDefault();
    if (!token) return;
    const newStock = stockDrafts[product.id];
    if (newStock === undefined || newStock === product.stockQty) return;
    setProductError(null);
    setSavingStockId(product.id);
    try {
      await updateStock(token, product.id, newStock);
      await refresh();
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Failed to update stock");
    } finally {
      setSavingStockId(null);
    }
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setEditName(product.name);
    setEditDescription(product.description);
    setEditImageUrl(product.imageUrl ?? "");
    setEditPriceEth(weiToEth(product.priceWei));
    setEditError(null);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !editingProduct) return;
    setEditError(null);
    setSaving(true);
    try {
      await updateProduct(token, editingProduct.id, {
        name: editName,
        description: editDescription,
        imageUrl: editImageUrl || undefined,
        priceWei: ethToWei(editPriceEth),
      });
      setEditingProduct(null);
      await refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(product: Product) {
    if (!token) return;
    if (!window.confirm(`Remove "${product.name}" from your listings?`)) return;
    setProductError(null);
    setRemovingId(product.id);
    try {
      await deleteProduct(token, product.id);
      await refresh();
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Failed to remove product");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Seller dashboard</h1>
        <button onClick={openListModal}>+ List new product</button>
      </div>

      {showListModal && (
        <Modal title="List a new product" onClose={() => setShowListModal(false)}>
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
            {createError && <p className="error">{createError}</p>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowListModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={creating}>
                {creating ? "Listing..." : "List product"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingProduct && (
        <Modal title={`Edit "${editingProduct.name}"`} onClose={() => setEditingProduct(null)}>
          <form onSubmit={handleEditSubmit}>
            <label>
              Name
              <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </label>
            <label>
              Description
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                required
              />
            </label>
            <label>
              Image URL
              <input
                type="url"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </label>
            <label>
              Price (ETH)
              <input
                type="number"
                step="0.0001"
                min="0"
                value={editPriceEth}
                onChange={(e) => setEditPriceEth(e.target.value)}
                required
              />
            </label>
            {editError && <p className="error">{editError}</p>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setEditingProduct(null)}>
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <section>
        <h2>Your products</h2>
        {productError && <p className="error">{productError}</p>}
        {products.length === 0 && (
          <p className="muted">You haven't listed any products yet. Click "+ List new product" to get started.</p>
        )}
        <div className="grid">
          {products.map((p) => {
            const draft = stockDrafts[p.id] ?? p.stockQty;
            const dirty = draft !== p.stockQty;
            return (
              <div className="card product-card" key={p.id}>
                {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="product-image" />}
                <h3>{p.name}</h3>
                <p className="price">{weiToEth(p.priceWei)} ETH</p>
                <form className="stock-row" onSubmit={(e) => handleStockSubmit(e, p)}>
                  <label>
                    Stock
                    <input
                      type="number"
                      min={0}
                      value={draft}
                      onChange={(e) =>
                        setStockDrafts((d) => ({ ...d, [p.id]: Number(e.target.value) }))
                      }
                    />
                  </label>
                  <button type="submit" disabled={!dirty || savingStockId === p.id}>
                    {savingStockId === p.id ? "Saving..." : "Update"}
                  </button>
                </form>
                <div className="card-actions">
                  <button type="button" className="secondary" onClick={() => openEditModal(p)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleRemove(p)}
                    disabled={removingId === p.id}
                  >
                    {removingId === p.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Incoming orders</h2>
        {orders.length === 0 ? (
          <p className="muted">No orders yet.</p>
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
                  <td>{o.product?.name ?? o.productName}</td>
                  <td>{o.quantity}</td>
                  <td>{weiToEth(o.totalPriceWei)} ETH</td>
                  <td>
                    <span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span>
                  </td>
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
