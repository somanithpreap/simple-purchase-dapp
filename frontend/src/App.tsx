import { Navigate, Route, Routes, Link, NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./context/AuthContext";
import WalletConnect from "./components/WalletConnect";
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
    <header className="site-header">
      <nav>
        <Link to="/products" className="brand">
          <img src="/favicon.svg" alt="" className="brand-logo" />
          <span className="brand-name">BoltMart</span>
        </Link>
        <NavLink to="/products">Products</NavLink>
        {user?.role === "CUSTOMER" && <NavLink to="/orders">My orders</NavLink>}
        {user?.role === "SELLER" && <NavLink to="/seller">Dashboard</NavLink>}
        <span className="spacer" />
        {user ? (
          <>
            <span className="user-chip" title={user.email}>
              <span className="user-email">{user.email}</span>
              <span className="role-tag">{user.role.toLowerCase()}</span>
            </span>
            {!user.walletAddress && <WalletConnect />}
            <button
              className="secondary"
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
            <NavLink to="/login">Log in</NavLink>
            <Link to="/register" className="button-link">
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
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
