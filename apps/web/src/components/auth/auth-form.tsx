"use client";

import { useState, type SyntheticEvent } from "react";

export function AuthForm({ mode }: { readonly mode: "login" | "onboarding" }) {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const stringField = (name: string): string => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };
    const invitation = new URLSearchParams(window.location.search).get(
      "invitation"
    );
    const response = await fetch(
      mode === "login" ? "/api/auth/sign-in/email" : "/api/auth/sign-up/email",
      {
        body: JSON.stringify({
          email: stringField("email"),
          password: stringField("password"),
          ...(mode === "onboarding" ? { name: stringField("name") } : {})
        }),
        headers: {
          "content-type": "application/json",
          ...(invitation === null ? {} : { "x-qusto-invitation": invitation })
        },
        method: "POST"
      }
    );
    setLoading(false);
    if (!response.ok) {
      setError(
        mode === "login"
          ? "Invalid email or password."
          : "Registration is closed or the invitation is invalid."
      );
      return;
    }
    window.location.assign("/");
  }

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      {mode === "onboarding" ? (
        <label>
          Name
          <input name="name" required />
        </label>
      ) : null}
      <label>
        Email
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        Password
        <input
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={12}
          name="password"
          required
          type="password"
        />
      </label>
      {error === undefined ? null : <p className="form-error">{error}</p>}
      <button className="primary-button" disabled={loading} type="submit">
        {loading
          ? "Working…"
          : mode === "login"
            ? "Sign in"
            : "Create deployment"}
      </button>
    </form>
  );
}
