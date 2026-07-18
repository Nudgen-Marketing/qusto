# Qusto dashboard design system

**Source concept:** `docs/design/dashboard-concept.png`

## Visual direction

- Desktop canvas: 1536 × 1024.
- True dark navy background with graphite navigation and open bordered regions.
- Persistent 232 px sidebar, 70 px top bar, dominant trace table, and 350 px trace-detail rail.
- UI uses a neo-grotesk sans stack; addresses, hashes, amounts, and latency use a monospace stack.
- Controls use 8 px radii, thin borders, restrained shadows, and no gradients or glass effects.

## Tokens

| Role           | Value     |
| -------------- | --------- |
| Canvas         | `#020d1d` |
| Sidebar        | `#061426` |
| Surface        | `#07182b` |
| Raised surface | `#0a1d33` |
| Border         | `#1c3149` |
| Text           | `#f7f9fc` |
| Muted text     | `#8ea0b7` |
| Accent         | `#1473ff` |
| Success        | `#2ed477` |
| Warning        | `#f6b91f` |
| Danger         | `#ff4d55` |

Spacing follows a 4 px base scale. Typography ranges from 12 px table metadata to 26 px page titles. UI controls use 13–14 px text with explicit line heights.

## Component inventory

- App shell, navigation rows, environment selector, primary button, connection status.
- Metric strip with four equally weighted metrics.
- Filter controls, search input, pause control, live trace table, selected row, and pagination.
- Spend line chart and policy-health rows.
- Trace metadata definition list and vertical lifecycle timeline.
- Responsive drawer navigation and stacked trace detail below 900 px.

## Allowed first-viewport copy

Qusto; Overview; Traces; Policies; Webhooks; Team; Settings; Payment governance; Production; Create policy; Total spend; Payments; Denied; P95 decision; Live payment traces; Trace timeline; Policy coverage; Payment required; Policy allowed; Payload signed; Settlement confirmed.
