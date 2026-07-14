import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register as apiRegister } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../api/types";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("CUSTOMER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user, token } = await apiRegister(email, password, role);
      login(user, token);
      navigate("/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card narrow">
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <fieldset>
          <legend>I am a...</legend>
          <label className="inline">
            <input
              type="radio"
              name="role"
              checked={role === "CUSTOMER"}
              onChange={() => setRole("CUSTOMER")}
            />
            Customer
          </label>
          <label className="inline">
            <input
              type="radio"
              name="role"
              checked={role === "SELLER"}
              onChange={() => setRole("SELLER")}
            />
            Seller
          </label>
        </fieldset>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
