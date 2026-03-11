/**
 * Sylva Trial → Subscription Drop-off Analysis Dashboard
 * Interactive React dashboard with dark theme.
 *
 * This file is used as a template — the build process injects analysis data
 * and produces a self-contained HTML file.
 */

const TABS = ['Trial Cohort', 'Engagement Gap', 'Subscription Funnel', 'Retention', 'Actions'];

function App({ data }) {
  const [activeTab, setActiveTab] = React.useState(0);
  const [sortConfig, setSortConfig] = React.useState({ key: 'totalSessions', direction: 'desc' });

  const chat = data.chatDigest || {};
  const uxEvents = data.uxcamEvents || {};
  const uxScreens = data.uxcamScreens || {};
  const retention = data.retention || {};
  const activeSubs = data.activeSubscriptions || {};
  const mrr = data.mrr || {};
  const actions = data.actions || [];
  const blockers = data.blockers || {};
  const sanityChecks = data.sanityChecks || [];
  const weekLabel = data.weekLabel || 'Unknown';
  const previousWeek = data.previousWeek || null;

  return (
    <div style={{ background: '#020617', color: '#e2e8f0', minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif", padding: '24px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, margin: 0, color: '#f8fafc' }}>
          Sylva Trial → Subscription Analysis
        </h1>
        <p style={{ color: '#94a3b8', margin: '8px 0 0', fontSize: '14px' }}>
          Week: {weekLabel} | Generated: {new Date().toLocaleDateString()}
        </p>
      </header>

      {/* Tab Navigation */}
      <nav style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #1e293b', paddingBottom: '0' }}>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              padding: '10px 20px',
              background: activeTab === i ? '#1e293b' : 'transparent',
              color: activeTab === i ? '#60a5fa' : '#94a3b8',
              border: 'none',
              borderBottom: activeTab === i ? '2px solid #60a5fa' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === i ? 600 : 400,
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      {activeTab === 0 && <TrialCohortTab chat={chat} weekLabel={weekLabel} sortConfig={sortConfig} setSortConfig={setSortConfig} />}
      {activeTab === 1 && <EngagementGapTab chat={chat} />}
      {activeTab === 2 && <SubscriptionFunnelTab uxEvents={uxEvents} uxScreens={uxScreens} />}
      {activeTab === 3 && <RetentionTab retention={retention} activeSubs={activeSubs} mrr={mrr} />}
      {activeTab === 4 && <ActionsTab actions={actions} blockers={blockers} />}

      {/* Sanity Checks Footer */}
      <SanityChecksFooter checks={sanityChecks} />
    </div>
  );
}

/* ─── Metric Card ─── */
function MetricCard({ label, value, subtext, color = '#60a5fa', trend }) {
  return (
    <div style={{
      background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px',
      padding: '20px', minWidth: '160px', flex: 1,
    }}>
      <div style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '32px', fontWeight: 700, color, lineHeight: 1.1 }}>
        {value ?? '—'}
      </div>
      {subtext && <div style={{ color: '#64748b', fontSize: '12px', marginTop: '6px' }}>{subtext}</div>}
      {trend !== undefined && trend !== null && (
        <div style={{ color: trend > 0 ? '#34d399' : trend < 0 ? '#f87171' : '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)} vs prev week
        </div>
      )}
    </div>
  );
}

/* ─── Simple Bar ─── */
function HBar({ label, value, max, color = '#3b82f6' }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
        <span style={{ color: '#cbd5e1' }}>{label}</span>
        <span style={{ color: '#94a3b8' }}>{value}</span>
      </div>
      <div style={{ background: '#1e293b', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, background: color, height: '100%', borderRadius: '4px', transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

/* ─── Trial Cohort Tab ─── */
function TrialCohortTab({ chat, weekLabel, sortConfig, setSortConfig }) {
  const segments = chat.trialSegments || {};
  const totalTrial = chat.statusCounts?.trial || 0;
  const activeTrial = segments.active_trial || 0;
  const lapsedTrial = segments.expired_lapsed || 0;
  const converted = chat.statusCounts?.active || 0;
  const totalUsers = totalTrial + converted + (chat.statusCounts?.free || 0) + (chat.statusCounts?.cancelled || 0);
  const conversionRate = totalUsers > 0 ? ((converted / totalUsers) * 100).toFixed(1) : '—';

  const segmentData = [
    { label: 'High-engagement, no convert', count: segments.high_engagement_no_convert || 0, color: '#f59e0b' },
    { label: 'Moderate, fading', count: segments.moderate_fading || 0, color: '#f97316' },
    { label: 'Single session', count: segments.single_session || 0, color: '#ef4444' },
    { label: 'Active trial', count: segments.active_trial || 0, color: '#22c55e' },
    { label: 'Expired/lapsed', count: segments.expired_lapsed || 0, color: '#6366f1' },
  ];

  // Sortable trial user table
  const profiles = chat.trialProfiles || [];
  const sorted = [...profiles].sort((a, b) => {
    const aVal = a[sortConfig.key] ?? 0;
    const bVal = b[sortConfig.key] ?? 0;
    return sortConfig.direction === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  return (
    <div>
      {/* Metric Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <MetricCard label="Total Trial Users" value={totalTrial} />
        <MetricCard label="Active Trial (48h)" value={activeTrial} color="#22c55e" />
        <MetricCard label="Lapsed Trial" value={lapsedTrial} color="#ef4444" />
        <MetricCard label="Converted (Paid)" value={converted} color="#a78bfa" />
        <MetricCard label="Trial-to-Paid Rate" value={`${conversionRate}%`} color="#f59e0b" />
      </div>

      {/* Segment Breakdown */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f8fafc' }}>Trial User Segments</h3>
        {segmentData.map(seg => (
          <HBar key={seg.label} label={seg.label} value={seg.count} max={totalTrial} color={seg.color} />
        ))}
      </div>

      {/* User Table */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f8fafc' }}>Trial Users Detail</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              {[
                { key: 'userId', label: 'User ID' },
                { key: 'segment', label: 'Segment' },
                { key: 'totalSessions', label: 'Sessions' },
                { key: 'daysActive', label: 'Days Active' },
                { key: 'meanCSAT', label: 'CSAT' },
                { key: 'totalMessages', label: 'Messages' },
                { key: 'testsCompletedCount', label: 'Tests' },
                { key: 'pss10Change', label: 'PSS10 Δ' },
                { key: 'lastChat', label: 'Last Chat' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: '8px 12px', textAlign: 'left', color: '#94a3b8', cursor: 'pointer',
                    fontWeight: sortConfig.key === col.key ? 700 : 400,
                  }}
                >
                  {col.label} {sortConfig.key === col.key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 100).map((p, i) => (
              <tr key={p.userId} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : '#0a1628' }}>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '11px' }}>{(p.userId || '').substring(0, 12)}...</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                    background: p.segment === 'active_trial' ? '#064e3b' : p.segment === 'expired_lapsed' ? '#4c0519' : p.segment === 'high_engagement_no_convert' ? '#78350f' : '#1e293b',
                    color: p.segment === 'active_trial' ? '#34d399' : p.segment === 'expired_lapsed' ? '#fda4af' : p.segment === 'high_engagement_no_convert' ? '#fbbf24' : '#94a3b8',
                  }}>
                    {(p.segment || 'unknown').replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>{p.totalSessions}</td>
                <td style={{ padding: '8px 12px' }}>{p.daysActive}</td>
                <td style={{ padding: '8px 12px' }}>{p.meanCSAT ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>{p.totalMessages}</td>
                <td style={{ padding: '8px 12px' }}>{p.testsCompletedCount}</td>
                <td style={{ padding: '8px 12px', color: p.pss10Change < 0 ? '#34d399' : p.pss10Change > 0 ? '#f87171' : '#94a3b8' }}>
                  {p.pss10Change !== null ? p.pss10Change : '—'}
                </td>
                <td style={{ padding: '8px 12px', fontSize: '11px' }}>
                  {p.lastChat ? new Date(p.lastChat).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {profiles.length > 100 && <p style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>Showing first 100 of {profiles.length} users</p>}
      </div>
    </div>
  );
}

/* ─── Engagement Gap Tab ─── */
function EngagementGapTab({ chat }) {
  const gaps = chat.engagementGaps || {};
  const strongest = chat.strongestPredictor;
  const trial = chat.trialMetrics || {};
  const paid = chat.paidMetrics || {};

  const metrics = [
    { label: 'Median Sessions', trial: trial.medianSessions, paid: paid.medianSessions },
    { label: 'Messages / Session', trial: gaps.messagesPerSession?.trial, paid: gaps.messagesPerSession?.paid, ratio: gaps.messagesPerSession?.ratio },
    { label: 'Duration (min)', trial: gaps.duration?.trial, paid: gaps.duration?.paid, ratio: gaps.duration?.ratio },
    { label: 'CSAT Score', trial: gaps.csat?.trial, paid: gaps.csat?.paid },
    { label: 'Tests Completed', trial: gaps.testsCompleted?.trial, paid: gaps.testsCompleted?.paid, ratio: gaps.testsCompleted?.ratio, highlight: true },
    { label: 'PSS10 Change', trial: gaps.pss10Change?.trial, paid: gaps.pss10Change?.paid },
    { label: 'Days Active', trial: trial.medianDaysActive, paid: paid.medianDaysActive },
  ];

  return (
    <div>
      {/* Key Insight Callout */}
      {strongest && (
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b, #172554)', border: '1px solid #3730a3',
          borderRadius: '12px', padding: '20px', marginBottom: '24px',
        }}>
          <div style={{ fontSize: '12px', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            Key Insight
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#f8fafc' }}>
            Paid users have {strongest.ratio}x more {strongest.metric.toLowerCase()} than trial users
          </div>
          <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px' }}>
            {strongest.metric} appears to be the strongest predictor of conversion.
            {strongest.metric === 'Tests Completed' ? ' Track whether this pattern holds week-over-week.' : ''}
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f8fafc' }}>Trial vs Paid Comparison</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#94a3b8' }}>Metric</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', color: '#f87171' }}>Trial</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', color: '#34d399' }}>Paid</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', color: '#94a3b8' }}>Gap</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr key={m.label} style={{
                borderBottom: '1px solid #1e293b',
                background: m.highlight ? '#1e1b4b22' : i % 2 === 0 ? 'transparent' : '#0a1628',
              }}>
                <td style={{ padding: '10px 16px', fontWeight: m.highlight ? 600 : 400 }}>{m.label}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center', color: '#f87171' }}>{m.trial ?? '—'}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center', color: '#34d399' }}>{m.paid ?? '—'}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center', color: m.ratio && m.ratio > 2 ? '#fbbf24' : '#94a3b8' }}>
                  {m.ratio ? `${m.ratio}x` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Emotions & Topics */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#f8fafc' }}>Top Topics (Trial)</h3>
          {(trial.topTopics || []).slice(0, 8).map(t => (
            <HBar key={t.value} label={t.value} value={t.count} max={(trial.topTopics?.[0]?.count) || 1} color="#6366f1" />
          ))}
        </div>
        <div style={{ flex: 1, minWidth: '300px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#f8fafc' }}>Top Topics (Paid)</h3>
          {(paid.topTopics || []).slice(0, 8).map(t => (
            <HBar key={t.value} label={t.value} value={t.count} max={(paid.topTopics?.[0]?.count) || 1} color="#22c55e" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Subscription Funnel Tab ─── */
function SubscriptionFunnelTab({ uxEvents, uxScreens }) {
  const funnel = uxEvents.subscriptionFunnel || [];
  const maxUsers = funnel.length > 0 ? funnel[0].uniqueUsers : 1;
  const screens = uxScreens.targetScreens || {};

  return (
    <div>
      {/* Funnel Visualization */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: '#f8fafc' }}>Subscription Sub-Funnel</h3>
        {funnel.map((step, i) => {
          const widthPct = maxUsers > 0 ? Math.max((step.uniqueUsers / maxUsers) * 100, 5) : 5;
          return (
            <div key={step.step} style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                <div style={{ width: '240px', fontSize: '13px', color: '#cbd5e1', textAlign: 'right' }}>
                  {step.step.replace(/_/g, ' ')}
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: `${widthPct}%`, background: `hsl(${220 + i * 15}, 70%, ${55 - i * 5}%)`,
                    height: '32px', borderRadius: '4px', display: 'flex', alignItems: 'center', paddingLeft: '8px',
                    fontSize: '13px', fontWeight: 600, color: '#fff', minWidth: '40px',
                    transition: 'width 0.5s',
                  }}>
                    {step.uniqueUsers}
                  </div>
                  {step.dropRate !== null && step.dropRate > 0 && (
                    <span style={{ color: '#f87171', fontSize: '12px' }}>
                      -{step.dropRate}%
                    </span>
                  )}
                </div>
              </div>
              {i < funnel.length - 1 && (
                <div style={{ width: '240px', textAlign: 'right', marginRight: '12px', display: 'inline-block' }}>
                  <span style={{ color: '#475569', fontSize: '18px' }}>↓</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* From-page analysis */}
      {uxEvents.fromPageAnalysis && Object.keys(uxEvents.fromPageAnalysis).length > 0 && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: '#f8fafc' }}>Pricing View Sources</h3>
          {Object.entries(uxEvents.fromPageAnalysis).map(([event, sources]) => (
            <div key={event} style={{ marginBottom: '12px' }}>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>{event.replace(/_/g, ' ')}</div>
              {Object.entries(sources).map(([page, count]) => (
                <HBar key={page} label={page} value={count} max={Math.max(...Object.values(sources))} color="#818cf8" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Screen Metrics */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f8fafc' }}>Key Screen Metrics</h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {['/subscribe', '/trial-start', '/chat', '/settings'].map(screen => {
            const s = screens[screen];
            return (
              <div key={screen} style={{ flex: 1, minWidth: '200px', background: '#020617', borderRadius: '8px', padding: '16px', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '12px' }}>{screen}</div>
                {s ? (
                  <>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Sessions: <span style={{ color: '#e2e8f0' }}>{s.totalSessions ?? '—'}</span></div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Bounce Rate: <span style={{ color: s.bounceRate > 50 ? '#f87171' : '#e2e8f0' }}>{s.bounceRate ?? '—'}%</span></div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Engagement: <span style={{ color: '#e2e8f0' }}>{s.medianEngagementTime ?? '—'}s</span></div>
                  </>
                ) : (
                  <div style={{ fontSize: '12px', color: '#475569' }}>No data</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Retention Tab ─── */
function RetentionTab({ retention, activeSubs, mrr }) {
  const cohorts = retention.cohorts || [];
  const survivalCurve = retention.survivalCurve || {};
  const months = Object.keys(survivalCurve).map(Number).sort((a, b) => a - b);
  const maxMonth = months.length > 0 ? months[months.length - 1] : 12;

  // Benchmark comparison
  const benchmarks = [
    { metric: 'Trial → Paid', sylva: '~2.5%', hfMedian: '39.9%', hfTop10: '68.3%' },
    { metric: 'Month 1 Retention', sylva: `${retention.month1Retention || '—'}%`, hfMedian: '—', hfTop10: '—' },
  ];

  return (
    <div>
      {/* Key Metrics */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <MetricCard label="Active Subscriptions" value={activeSubs.latest?.sylva ?? '—'} color="#a78bfa" />
        <MetricCard label="MRR" value={mrr.latest?.sylva ? `£${mrr.latest.sylva.toFixed(2)}` : '—'} color="#34d399" />
        <MetricCard label="Month 1 Retention" value={retention.month1Retention ? `${retention.month1Retention}%` : '—'} color="#60a5fa" />
        <MetricCard label="Month 6 Retention" value={retention.month6Retention ? `${retention.month6Retention}%` : '—'} color="#f59e0b" />
      </div>

      {/* Cohort Survival Chart (ASCII/table-based) */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f8fafc' }}>Survival Curve (All Cohorts)</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '200px', padding: '0 16px' }}>
          {months.map(m => {
            const rate = survivalCurve[m]?.rate || 0;
            return (
              <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>{rate}%</div>
                <div style={{
                  width: '100%', maxWidth: '40px',
                  height: `${rate * 2}px`,
                  background: `hsl(${220 + m * 10}, 60%, 50%)`,
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.5s',
                }} />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>M{m}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cohort Detail Table */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', marginBottom: '24px', overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f8fafc' }}>Cohort Detail</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#94a3b8' }}>Cohort</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8' }}>Subs</th>
              {Array.from({ length: Math.min(maxMonth, 12) }, (_, i) => (
                <th key={i + 1} style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8' }}>M{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c, i) => (
              <tr key={c.name} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : '#0a1628' }}>
                <td style={{ padding: '8px 12px' }}>{c.name}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{c.subscriptions}</td>
                {Array.from({ length: Math.min(maxMonth, 12) }, (_, mi) => {
                  const val = c.months[mi + 1];
                  const pct = c.subscriptions > 0 && val !== undefined ? Math.round(val / c.subscriptions * 100) : null;
                  return (
                    <td key={mi + 1} style={{ padding: '8px 12px', textAlign: 'center', color: val !== undefined ? '#e2e8f0' : '#334155' }}>
                      {val !== undefined ? `${val} (${pct}%)` : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Benchmark Comparison */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f8fafc' }}>Benchmark Comparison (RevenueCat 2025)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#94a3b8' }}>Metric</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', color: '#f87171' }}>Sylva</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', color: '#fbbf24' }}>H&F Median</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', color: '#34d399' }}>H&F Top 10%</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((b, i) => (
              <tr key={b.metric} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : '#0a1628' }}>
                <td style={{ padding: '10px 16px' }}>{b.metric}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center', color: '#f87171' }}>{b.sylva}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center', color: '#fbbf24' }}>{b.hfMedian}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center', color: '#34d399' }}>{b.hfTop10}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Actions Tab ─── */
function ActionsTab({ actions, blockers }) {
  const priorityColors = { P0: '#ef4444', P1: '#f59e0b', P2: '#3b82f6' };

  const blockerCategories = [
    { key: 'valueDelivery', label: 'Value Delivery Blockers' },
    { key: 'valueAwareness', label: 'Value Awareness Blockers' },
    { key: 'pricingTiming', label: 'Pricing/Timing Blockers' },
    { key: 'trialExpiration', label: 'Trial Expiration Blockers' },
  ];

  return (
    <div>
      {/* Priority Actions */}
      <h3 style={{ fontSize: '18px', color: '#f8fafc', marginBottom: '16px' }}>Priority Actions</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
        {actions.map((action, i) => (
          <div key={i} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <span style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                background: priorityColors[action.priority] || '#475569',
                color: '#fff',
              }}>
                {action.priority}
              </span>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>{action.what}</span>
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
              <p style={{ margin: '4px 0' }}><strong style={{ color: '#cbd5e1' }}>Why:</strong> {action.why}</p>
              <p style={{ margin: '4px 0' }}><strong style={{ color: '#cbd5e1' }}>Who:</strong> {action.who}</p>
              <p style={{ margin: '4px 0' }}><strong style={{ color: '#cbd5e1' }}>When:</strong> {action.when}</p>
              <p style={{ margin: '4px 0' }}><strong style={{ color: '#cbd5e1' }}>Expected Impact:</strong> {action.expectedImpact}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Conversion Blockers */}
      <h3 style={{ fontSize: '18px', color: '#f8fafc', marginBottom: '16px' }}>Identified Conversion Blockers</h3>
      {blockerCategories.map(cat => {
        const items = blockers[cat.key] || [];
        if (items.length === 0) return null;
        return (
          <div key={cat.key} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#f8fafc' }}>{cat.label}</h4>
            {items.map((b, i) => (
              <div key={i} style={{ marginBottom: '8px', paddingLeft: '12px', borderLeft: `3px solid ${b.severity === 'critical' ? '#ef4444' : b.severity === 'high' ? '#f59e0b' : '#3b82f6'}` }}>
                <div style={{ fontSize: '13px', color: '#e2e8f0' }}>{b.finding}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{b.implication}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Sanity Checks Footer ─── */
function SanityChecksFooter({ checks }) {
  if (!checks || checks.length === 0) return null;
  const [expanded, setExpanded] = React.useState(false);
  const allPassed = checks.every(c => c.passed !== false);

  return (
    <div style={{ marginTop: '32px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'transparent', border: 'none', color: allPassed ? '#34d399' : '#f59e0b',
          cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
        }}
      >
        {allPassed ? '✓' : '⚠'} Sanity Checks ({checks.filter(c => c.passed).length}/{checks.length} passed) {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <div style={{ marginTop: '8px' }}>
          {checks.map((c, i) => (
            <div key={i} style={{ fontSize: '12px', padding: '4px 0', color: c.passed ? '#34d399' : c.passed === false ? '#f87171' : '#94a3b8' }}>
              {c.passed ? '✓' : c.passed === false ? '✗' : '?'} {c.name}: {c.detail}
              {c.note && <span style={{ color: '#64748b' }}> ({c.note})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
