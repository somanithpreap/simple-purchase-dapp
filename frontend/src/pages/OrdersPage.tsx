import { useEffect, useState } from "react";
import { listMyOrders, submitConfirmTx } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Order } from "../api/types";
import { weiToEth } from "../utils/format";
import { ensureNetwork, getSigner } from "../web3/wallet";
import { getContractInfoCached, getMarketplaceContract } from "../web3/contract";

function isUserRejection(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "ACTION_REJECTED";
}

export default function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!token) return;
    setOrders(await listMyOrders(token));
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleConfirm(orderId: number) {
    if (!token) return;
    setError(null);
    try {
      const { chainId } = await getContractInfoCached();
      await ensureNetwork(chainId);
      const signer = await getSigner();
      const contract = await getMarketplaceContract(signer);
      const tx = await contract.confirmDelivery!(orderId);
      await submitConfirmTx(token, orderId, tx.hash);
      await refresh();
    } catch (err) {
      if (isUserRejection(err)) {
        setError("Transaction rejected in wallet.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to confirm delivery");
      }
    }
  }

  return (
    <div>
      <h1>My orders</h1>
      {error && <p className="error">{error}</p>}
      {orders.length === 0 ? (
        <p className="muted">You haven't bought anything yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
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
                <td>
                  {o.status === "ESCROWED" && (
                    <button onClick={() => handleConfirm(o.id)}>Confirm delivery</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
