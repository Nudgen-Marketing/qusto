"use client";

import { useActionState } from "react";

import {
  createApiKeyAction,
  createInvitationAction,
  createPolicyDraftAction,
  createWebhookAction
} from "../../server/dashboard-actions";

const initialState = {};

function Feedback({
  state
}: {
  readonly state: { error?: string; secret?: string; success?: string };
}) {
  return (
    <div aria-live="polite" className="action-feedback">
      {state.error === undefined ? null : (
        <p className="error-message">{state.error}</p>
      )}
      {state.success === undefined ? null : (
        <p className="success-text">{state.success}</p>
      )}
      {state.secret === undefined ? null : (
        <code className="one-time-secret">{state.secret}</code>
      )}
    </div>
  );
}

export function ApiKeyForm() {
  const [state, action, pending] = useActionState(
    createApiKeyAction,
    initialState
  );
  return (
    <form action={action} className="management-form">
      <label>
        Name
        <input
          name="name"
          maxLength={100}
          placeholder="Production SDK"
          required
        />
      </label>
      <button className="primary-button" disabled={pending}>
        {pending ? "Creating…" : "Create API key"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function InvitationForm() {
  const [state, action, pending] = useActionState(
    createInvitationAction,
    initialState
  );
  return (
    <form action={action} className="management-form form-grid">
      <label>
        Email
        <input type="email" name="email" maxLength={320} required />
      </label>
      <label>
        Role
        <select name="role" defaultValue="developer">
          <option value="admin">Admin</option>
          <option value="developer">Developer</option>
          <option value="viewer">Viewer</option>
        </select>
      </label>
      <button className="primary-button" disabled={pending}>
        {pending ? "Creating…" : "Create invitation"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function WebhookForm() {
  const [state, action, pending] = useActionState(
    createWebhookAction,
    initialState
  );
  return (
    <form action={action} className="management-form">
      <label>
        HTTPS endpoint
        <input
          type="url"
          name="url"
          placeholder="https://example.com/qusto"
          required
        />
      </label>
      <label>
        Events
        <input
          name="eventTypes"
          defaultValue="policy.denied, settlement.failed, chain.reverted"
          required
        />
      </label>
      <button className="primary-button" disabled={pending}>
        {pending ? "Creating…" : "Add webhook"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

const starterPolicy = JSON.stringify(
  [
    {
      id: "max-10-usdc",
      kind: "max-amount",
      maxAmountAtomic: "10000000",
      phases: ["buyer", "seller"]
    }
  ],
  null,
  2
);

export function PolicyDraftForm() {
  const [state, action, pending] = useActionState(
    createPolicyDraftAction,
    initialState
  );
  return (
    <form action={action} className="management-form policy-editor">
      <label>
        Rules JSON
        <textarea
          name="rules"
          defaultValue={starterPolicy}
          maxLength={64_000}
          required
        />
      </label>
      <p className="form-help">
        Atomic USDC amounts use six decimals. Drafts are immutable after
        publication.
      </p>
      <button className="primary-button" disabled={pending}>
        {pending ? "Validating…" : "Save draft"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
