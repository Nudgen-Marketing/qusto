import {
  Check,
  ChevronDown,
  CirclePause,
  ListFilter,
  Search,
  X
} from "lucide-react";

import type { DashboardData, TraceRow } from "./demo-data";
import { DashboardSidebar } from "./sidebar";
import { SpendChart } from "./spend-chart";

function MetricStrip({ data }: { readonly data: DashboardData["metrics"] }) {
  return (
    <section aria-label="Payment metrics" className="metric-strip">
      {data.map((metric) => (
        <div className="metric" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>
            24h <em data-tone={metric.changeTone}>{metric.change}</em>
          </small>
        </div>
      ))}
    </section>
  );
}

function Status({ value }: { readonly value: TraceRow["status"] }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>{value}</span>
  );
}

function TraceTable({ traces }: { readonly traces: DashboardData["traces"] }) {
  return (
    <div className="trace-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Resource</th>
            <th>Payer</th>
            <th>Amount</th>
            <th>Policy</th>
            <th>Latency</th>
            <th>Time ↓</th>
          </tr>
        </thead>
        <tbody>
          {traces.map((trace, index) => (
            <tr
              className={index === 0 ? "selected-row" : undefined}
              key={trace.id}
            >
              <td>
                <Status value={trace.status} />
              </td>
              <td>{trace.resource}</td>
              <td>{trace.payer}</td>
              <td>{trace.amount}</td>
              <td>{trace.policy}</td>
              <td>{trace.latency}</td>
              <td>{trace.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="pagination">
        <span>Showing 1 to 7 of 1,247 results</span>
        <nav aria-label="Trace pages">
          <button className="page-active">1</button>
          <button>2</button>
          <button>3</button>
          <span>…</span>
          <button>125</button>
        </nav>
      </footer>
    </div>
  );
}

function percentage(count: number, total: number): string {
  return `${(total === 0 ? 0 : (count / total) * 100).toFixed(1)}%`;
}

function PolicyHealth({
  data
}: {
  readonly data: DashboardData["policyHealth"];
}) {
  return (
    <section className="policy-health">
      <strong>Policy health</strong>
      <dl>
        <div>
          <dt>
            <span className="health-icon success">
              <Check />
            </span>
            Healthy policies
          </dt>
          <dd>
            {data.healthy} <small>{percentage(data.healthy, data.total)}</small>
          </dd>
        </div>
        <div>
          <dt>
            <span className="health-icon warning">!</span>Policies with warnings
          </dt>
          <dd>
            {data.warning} <small>{percentage(data.warning, data.total)}</small>
          </dd>
        </div>
        <div>
          <dt>
            <span className="health-icon danger">
              <X />
            </span>
            Policies with errors
          </dt>
          <dd>
            {data.error} <small>{percentage(data.error, data.total)}</small>
          </dd>
        </div>
        <div>
          <dt>Total policies</dt>
          <dd>{data.total}</dd>
        </div>
      </dl>
      <a href="/policies">
        View all policies <span>›</span>
      </a>
    </section>
  );
}

function TraceDetail({ data }: { readonly data: DashboardData }) {
  const trace = data.selectedTrace;
  return (
    <aside className="trace-detail">
      <section>
        <header>
          <h2>Trace timeline</h2>
          <button aria-label="Close trace detail">
            <X />
          </button>
        </header>
        <dl className="trace-meta">
          <div>
            <dt>Transaction</dt>
            <dd className="accent">{trace.transaction}</dd>
          </div>
          <div>
            <dt>Resource</dt>
            <dd>{trace.resource}</dd>
          </div>
          <div>
            <dt>Payer</dt>
            <dd>{trace.payer}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>{trace.amount}</dd>
          </div>
          <div>
            <dt>Policy</dt>
            <dd>{trace.policy}</dd>
          </div>
          <div>
            <dt>Decision</dt>
            <dd>
              <Status value={trace.status} />
            </dd>
          </div>
          <div>
            <dt>Latency</dt>
            <dd>{trace.latency}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>{trace.network}</dd>
          </div>
        </dl>
        <ol className="timeline">
          {data.timeline.map((event) => (
            <li key={event.label}>
              <span className="timeline-dot">
                <Check />
              </span>
              <div>
                <strong>{event.label}</strong>
                <small>{event.time}</small>
              </div>
              <time>{event.duration}</time>
            </li>
          ))}
        </ol>
      </section>
      <section className="coverage">
        <h2>Policy coverage</h2>
        <dl>
          <div>
            <dt>Total policies</dt>
            <dd>{data.policyHealth.total}</dd>
          </div>
          <div>
            <dt>Resources covered</dt>
            <dd className="success-text">92.1%</dd>
          </div>
          <div>
            <dt>Requests covered</dt>
            <dd className="success-text">95.3%</dd>
          </div>
          <div>
            <dt>Default action</dt>
            <dd>Allow</dd>
          </div>
          <div>
            <dt>Uncovered requests (24h)</dt>
            <dd className="warning-text">58</dd>
          </div>
        </dl>
        <a href="/policies">
          View policy coverage <span>›</span>
        </a>
      </section>
    </aside>
  );
}

export function Dashboard({ data }: { readonly data: DashboardData }) {
  return (
    <main className="app-shell">
      <DashboardSidebar
        active="Overview"
        status={
          <>
            <span>
              <i />
              Live connection
            </span>
            <small>Block 19,842,731</small>
            <small>2s ago</small>
          </>
        }
      />
      <section className="workspace">
        <header className="topbar">
          <h1>Payment governance</h1>
          <div>
            <button className="environment">
              Production <ChevronDown />
            </button>
            <a className="primary-button" href="/policies">
              Create policy
            </a>
          </div>
        </header>
        <MetricStrip data={data.metrics} />
        <section className="content-grid">
          <div className="main-column">
            <div className="filters">
              <button>
                All status <ChevronDown />
              </button>
              <button>
                All resources <ChevronDown />
              </button>
              <button>
                Last 24 hours <ChevronDown />
              </button>
              <label>
                <Search />
                <input
                  aria-label="Search traces"
                  placeholder="Search by payer or tx hash..."
                />
              </label>
              <button className="pause">
                <CirclePause /> Pause
              </button>
              <button aria-label="Filter columns">
                <ListFilter />
              </button>
            </div>
            <h2 className="section-title">Live payment traces</h2>
            <TraceTable traces={data.traces} />
            <div className="lower-grid">
              <SpendChart series={data.spendTrend} />
              <PolicyHealth data={data.policyHealth} />
            </div>
          </div>
          <TraceDetail data={data} />
        </section>
      </section>
    </main>
  );
}
