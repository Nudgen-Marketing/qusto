import { AuthForm } from "../../components/auth/auth-form";

export default function OnboardingPage() {
  return (
    <main className="auth-page">
      <section className="auth-card wide">
        <span className="eyebrow">SELF-HOSTED X402 GOVERNANCE</span>
        <h1>Bootstrap Qusto</h1>
        <p>
          The first account becomes Admin. Qusto creates a default project with
          isolated development, staging, and production environments.
        </p>
        <AuthForm mode="onboarding" />
        <div className="install-snippet">
          <strong>After setup</strong>
          <code>pnpm add @qusto/sdk</code>
          <code>npx -y @qusto/mcp</code>
        </div>
      </section>
    </main>
  );
}
