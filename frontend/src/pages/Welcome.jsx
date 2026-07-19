import { Link } from "react-router-dom";
import { categories, products, suppliers } from "../services/mock/data.js";

const FEATURED = products.slice(0, 3);

function supplierFor(id) {
  return suppliers.find((s) => s.id === id);
}

export default function Welcome() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="container landing-nav-inner">
          <span className="welcome-brand-inline">
            <span className="welcome-mark">SB</span> SourceBridge Africa
          </span>
          <nav className="landing-nav-links">
            <a href="#explore">Explore</a>
            <Link to="/sign-in" className="btn btn-ghost-dark">Sign in</Link>
            <Link to="/create-account" className="btn btn-primary">Create account</Link>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <div className="container landing-hero-inner">
          <h1>Trade with businesses you can actually trust.</h1>
          <p className="lead">
            SourceBridge Africa connects buyers and verified suppliers through a secure marketplace
            with protected payments, tracked orders, and support when something needs a second look.
          </p>
          <div className="landing-hero-actions">
            <Link to="/create-account" className="btn btn-primary btn-lg">Create account</Link>
            <Link to="/sign-in" className="btn btn-outline btn-lg">Sign in</Link>
            <a href="#explore" className="btn btn-outline btn-lg">Explore marketplace</a>
          </div>
        </div>
      </section>

      <section className="landing-section" id="explore">
        <div className="container">
          <h2>A marketplace built around trust</h2>
          <div className="landing-value-grid">
            <div className="landing-value-card">
              <span className="landing-value-icon">🛡️</span>
              <h3>Verified suppliers</h3>
              <p>Every supplier is checked before they can list, with trust levels you can see on every product.</p>
            </div>
            <div className="landing-value-card">
              <span className="landing-value-icon">💳</span>
              <h3>Protected payments</h3>
              <p>Your money is held securely and only released once you approve what arrives.</p>
            </div>
            <div className="landing-value-card">
              <span className="landing-value-icon">📦</span>
              <h3>Tracked from order to delivery</h3>
              <p>Follow production, shipping, and inspection every step of the way, in one place.</p>
            </div>
          </div>

          <h2 style={{ marginTop: 48 }}>Browse a few categories</h2>
          <div className="landing-categories">
            {categories.map((c) => (
              <span key={c} className="pill pill-neutral landing-category-pill">{c}</span>
            ))}
          </div>

          <div className="landing-products">
            {FEATURED.map((p) => {
              const s = supplierFor(p.supplierId);
              return (
                <div key={p.id} className="landing-product-card">
                  <div className="landing-product-media">{p.category}</div>
                  <div className="landing-product-body">
                    <h4>{p.name}</h4>
                    <p className="muted">{s?.name}</p>
                    <p className="landing-product-price">{p.price}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="landing-explore-cta">
            <Link to="/create-account" className="btn btn-secondary">Create a free account to see full pricing and message suppliers</Link>
          </p>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="container landing-footer-inner">
          <span>© 2026 SourceBridge Africa</span>
          <Link to="/admin-login" className="landing-admin-link">Admin sign in</Link>
        </div>
      </footer>
    </div>
  );
}
