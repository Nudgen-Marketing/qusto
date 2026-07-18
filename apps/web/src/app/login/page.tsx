import { AuthForm } from "../../components/auth/auth-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">QUSTO CONTROL PLANE</span>
        <h1>Sign in</h1>
        <p>
          Access governed x402 traces, policies, keys, and delivery operations.
        </p>
        <AuthForm mode="login" />
      </section>
    </main>
  );
}
