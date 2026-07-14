import { Navigate, Route, Routes, Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProductsPage from "./pages/ProductsPage";
import SellerDashboardPage from "./pages/SellerDashboardPage";
import OrdersPage from "./pages/OrdersPage";

function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav>
      <Link to="/products">Products</Link>
      {user?.role === "CUSTOMER" && <Link to="/orders">My orders</Link>}
      {user?.role === "SELLER" && <Link to="/seller">Seller dashboard</Link>}
      <span className="spacer" />
      {user ? (
        <>
          <span>
            {user.email} ({user.role})
          </span>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Log out
          </button>
        </>
      ) : (
        <>
          <Link to="/login">Log in</Link>
          <Link to="/register">Register</Link>
        </>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <>
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/products" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route
            path="/orders"
            element={
              <RequireAuth>
                <OrdersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/seller"
            element={
              <RequireAuth>
                <SellerDashboardPage />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </>
  );
}
