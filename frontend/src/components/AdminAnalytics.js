import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, Legend, Cell,
} from 'recharts';
import { API_URL } from '../config';
import '../styles/AdminAnalytics.css';

function getDefaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

function getDefaultTo() {
  return new Date().toISOString().split('T')[0];
}

function healthLabel(score) {
  if (score >= 70) return 'good';
  if (score >= 40) return 'ok';
  return 'poor';
}

function benchmarkDelta(val, avg) {
  if (avg == null || avg === 0) return null;
  const diff = val - avg;
  const better = diff >= 0;
  // For price, format with $ and 2 decimals; otherwise round to int
  const fmtDiff = Number.isInteger(val)
    ? `${better ? '+' : ''}${Math.round(diff)}`
    : `${better ? '+' : ''}$${Math.abs(diff).toFixed(2)}${diff < 0 ? ' less' : ' more'}`;
  const fmtAvg = Number.isInteger(val) ? avg : `$${avg}`;
  return { label: `${fmtDiff} vs. avg (${fmtAvg})`, better };
}

export default function AdminAnalytics({ restaurantId, token }) {
  const [activeTab, setActiveTab] = useState('winelist'); // 'winelist' | 'engagement'
  const [from, setFrom] = useState(getDefaultFrom());
  const [to, setTo] = useState(getDefaultTo());

  // Wine list metrics state
  const [metrics, setMetrics] = useState(null);
  const [benchmarks, setBenchmarks] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState('');

  // Engagement state
  const [engagement, setEngagement] = useState(null);
  const [engLoading, setEngLoading] = useState(false);
  const [engError, setEngError] = useState('');
  const [convSort, setConvSort] = useState('views');

  const fetchMetrics = useCallback(async () => {
    if (!restaurantId) return;
    setMetricsLoading(true);
    setMetricsError('');
    try {
      const [mRes, bRes] = await Promise.all([
        fetch(`${API_URL}/analytics/restaurant/${restaurantId}?from=${from}&to=${to}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/analytics/system-benchmarks`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!mRes.ok) throw new Error('Failed to load analytics');
      setMetrics(await mRes.json());
      if (bRes.ok) setBenchmarks(await bRes.json());
    } catch {
      setMetricsError('Could not load analytics. Please try again.');
    } finally {
      setMetricsLoading(false);
    }
  }, [restaurantId, token, from, to]);

  const fetchEngagement = useCallback(async () => {
    setEngLoading(true);
    setEngError('');
    try {
      const res = await fetch(`${API_URL}/analytics/engagement?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load engagement');
      setEngagement(await res.json());
    } catch {
      setEngError('Could not load engagement data. Please try again.');
    } finally {
      setEngLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => {
    if (activeTab === 'winelist') fetchMetrics();
    else fetchEngagement();
  }, [activeTab, fetchMetrics, fetchEngagement]);

  if (!restaurantId) {
    return <div className="analytics-empty">Select a restaurant to view analytics.</div>;
  }

  const radarData = (() => {
    if (!metrics) return [];
    const total = metrics.totalWines || 1;
    // Scale 0.8–1.6× → 0–100 (covers real dataset range with headroom)
    const btgMarkupNorm = metrics.btgMarkupRatio != null
      ? Math.min(Math.max(Math.round(((metrics.btgMarkupRatio - 0.8) / 0.8) * 100), 0), 100) : 0;
    const entryPct = Math.round((metrics.priceRangeTiers.entry / total) * 100);
    const premiumPct = Math.round((metrics.priceRangeTiers.premium / total) * 100);
    const avgMed = benchmarks?.avgMedianBottlePrice;
    const pricePos = avgMed
      ? Math.min(Math.round((metrics.medianBottlePrice / (avgMed * 2)) * 100), 100)
      : 50;
    return [
      // Scale 0–20% → 0–100 (outlier-resistant; top quartile ≈ 13%)
      { subject: 'BTG Coverage',    value: Math.min(Math.round((metrics.btgCoverage / 20) * 100), 100),
        benchmark: benchmarks ? Math.min(Math.round((benchmarks.avgBtgCoverage / 20) * 100), 100) : 0,
        raw: `${metrics.btgCoverage}%`, benchRaw: benchmarks ? `${benchmarks.avgBtgCoverage}%` : null },
      { subject: 'Glass Markup',    value: btgMarkupNorm, benchmark: Math.round(((1.25 - 0.8) / 0.8) * 100),
        raw: metrics.btgMarkupRatio != null ? `${metrics.btgMarkupRatio}×` : 'N/A', benchRaw: '1.25× (system avg)' },
      { subject: 'Entry Wines',     value: entryPct, benchmark: 34,
        raw: `${entryPct}%`, benchRaw: '34% (system avg)' },
      { subject: 'Premium Wines',   value: premiumPct, benchmark: 25,
        raw: `${premiumPct}%`, benchRaw: '25% (system avg)' },
      { subject: 'Price vs. Market', value: pricePos, benchmark: 50,
        raw: metrics.medianBottlePrice ? `$${metrics.medianBottlePrice} median` : '—',
        benchRaw: avgMed ? `$${avgMed} system avg` : 'no benchmark' },
    ];
  })();

  return (
    <div className="admin-analytics">
      {/* Sub-tabs */}
      <div className="analytics-subtabs">
        <button
          className={`analytics-subtab ${activeTab === 'winelist' ? 'active' : ''}`}
          onClick={() => setActiveTab('winelist')}
        >
          Wine List Health
        </button>
        <button
          className={`analytics-subtab ${activeTab === 'engagement' ? 'active' : ''}`}
          onClick={() => setActiveTab('engagement')}
        >
          User Engagement
        </button>
      </div>

      {/* Date controls */}
      <div className="analytics-controls">
        <label>From</label>
        <input type="date" className="analytics-date-input" value={from} max={to}
          onChange={e => setFrom(e.target.value)} />
        <label>To</label>
        <input type="date" className="analytics-date-input" value={to} min={from}
          onChange={e => setTo(e.target.value)} />
        {activeTab === 'winelist' && (
          <button className="analytics-export-btn"
            onClick={() => window.open(`${API_URL}/analytics/restaurant/${restaurantId}/export.csv`, '_blank')}>
            ↓ Export Wine CSV
          </button>
        )}
        {activeTab === 'engagement' && (
          <button className="analytics-export-btn"
            onClick={() => window.open(`${API_URL}/analytics/events/export.csv?from=${from}&to=${to}`, '_blank')}>
            ↓ Export Events CSV
          </button>
        )}
      </div>

      {/* ── WINE LIST TAB ── */}
      {activeTab === 'winelist' && (
        <>
          {metricsError && <div className="admin-error-msg" style={{ marginBottom: 16 }}>{metricsError}</div>}
          {metricsLoading && <div className="analytics-loading">Loading analytics…</div>}
          {!metricsLoading && metrics && (
            <>
              <div className="analytics-stats-row">
                <StatCard label="BTG Coverage" value={`${metrics.btgCoverage}%`}
                  benchmarks={benchmarks} rawValue={metrics.btgCoverage} avgKey="avgBtgCoverage"
                  subtitle={metrics.btgCoverage === 0 ? 'Bottle-only list' : null} />
                <StatCard label="Total Wines" value={metrics.totalWines} benchmarks={null} />
                <StatCard label="Red / White / Other"
                  value={`${metrics.redPct}% · ${metrics.whitePct}% · ${100 - metrics.redPct - metrics.whitePct}%`}
                  benchmarks={null} subtitle="red · white · sparkling/rosé/other" />
                <PriceRangeCard tiers={metrics.priceRangeTiers} />
              </div>

              <div className="analytics-stats-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 16 }}>
                <StatCard label="Median Bottle Price"
                  value={metrics.medianBottlePrice ? `$${metrics.medianBottlePrice}` : '—'}
                  benchmarks={benchmarks} rawValue={metrics.medianBottlePrice} avgKey="avgMedianBottlePrice" />
                <StatCard label="BTG Markup Ratio"
                  value={metrics.btgMarkupRatio != null ? `${metrics.btgMarkupRatio}×` : '—'}
                  benchmarks={null}
                  subtitle={metrics.btgMarkupRatio == null ? 'No BTG wines' : '(glass × 5) ÷ bottle — ideal ≈ 1.0'} />
              </div>

              {/* 5 KPI Cards */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b0000', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Wine Program KPIs</div>
                <div className="analytics-stats-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 28 }}>
                  <div className="analytics-stat-card">
                    <div className="analytics-stat-value" style={{ fontSize: 22 }}>
                      {metrics.glassPourProfitIndex != null ? metrics.glassPourProfitIndex.toFixed(1) : '—'}
                    </div>
                    <div className="analytics-stat-label">Glass Pour Profit Index</div>
                    <div className="analytics-stat-benchmark">BTG coverage × markup ratio</div>
                    {benchmarks?.avgGlassPourProfitIndex != null && (
                      <div className={`analytics-stat-benchmark ${metrics.glassPourProfitIndex >= benchmarks.avgGlassPourProfitIndex ? 'better' : 'worse'}`}>
                        avg: {benchmarks.avgGlassPourProfitIndex.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <div className="analytics-stat-card">
                    <div className="analytics-stat-value" style={{ fontSize: 22 }}>
                      {metrics.tierConversion ? `${metrics.tierConversion.mid}%` : '—'}
                    </div>
                    <div className="analytics-stat-label">Mid-Tier BTG Rate</div>
                    <div className="analytics-stat-benchmark">$75–$150 wines by the glass</div>
                    {benchmarks?.avgTierConversionMid != null && (
                      <div className={`analytics-stat-benchmark ${(metrics.tierConversion?.mid ?? 0) >= benchmarks.avgTierConversionMid ? 'better' : 'worse'}`}>
                        avg: {benchmarks.avgTierConversionMid}%
                      </div>
                    )}
                  </div>
                  <div className="analytics-stat-card">
                    <div className="analytics-stat-value" style={{ fontSize: 22 }}>
                      {metrics.varietalHHI ?? '—'}
                    </div>
                    <div className="analytics-stat-label">Varietal Concentration (HHI)</div>
                    <div className="analytics-stat-benchmark">lower = more diverse</div>
                    {benchmarks?.avgVarietalHHI != null && (
                      <div className={`analytics-stat-benchmark ${(metrics.varietalHHI ?? 9999) <= benchmarks.avgVarietalHHI ? 'better' : 'worse'}`}>
                        avg: {benchmarks.avgVarietalHHI}
                      </div>
                    )}
                  </div>
                  <div className="analytics-stat-card">
                    <div className="analytics-stat-value" style={{ fontSize: 22 }}>
                      {metrics.priceSpreadIndex != null ? `${metrics.priceSpreadIndex}×` : '—'}
                    </div>
                    <div className="analytics-stat-label">Price Spread Index</div>
                    <div className="analytics-stat-benchmark">p90 ÷ p10 bottle price</div>
                    {benchmarks?.avgPriceSpreadIndex != null && (
                      <div className={`analytics-stat-benchmark ${(metrics.priceSpreadIndex ?? 0) >= benchmarks.avgPriceSpreadIndex ? 'better' : 'worse'}`}>
                        avg: {benchmarks.avgPriceSpreadIndex}×
                      </div>
                    )}
                  </div>
                  <div className="analytics-stat-card">
                    <div className="analytics-stat-value" style={{ fontSize: 22 }}>
                      {metrics.btgMarkupConsistency != null ? `${Math.round(metrics.btgMarkupConsistency * 100)}%` : '—'}
                    </div>
                    <div className="analytics-stat-label">Markup Consistency</div>
                    <div className="analytics-stat-benchmark">pricing strategy coherence</div>
                    {benchmarks?.avgBtgMarkupConsistency != null && (
                      <div className={`analytics-stat-benchmark ${(metrics.btgMarkupConsistency ?? 0) >= benchmarks.avgBtgMarkupConsistency ? 'better' : 'worse'}`}>
                        avg: {Math.round(benchmarks.avgBtgMarkupConsistency * 100)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="analytics-charts-grid">
                <div className="analytics-section">
                  <div className="analytics-chart-wrap">
                    <h3 style={{ marginTop: 0 }}>Varietal Distribution</h3>
                    {metrics.varietalDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={metrics.varietalDistribution} layout="vertical"
                          margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(v) => [`${v} wines`, 'Count']} />
                          <Bar dataKey="count" fill="#8b0000" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div className="analytics-empty">No varietal data</div>}
                  </div>
                </div>

                <div className="analytics-section">
                  <div className="analytics-chart-wrap">
                    <h3 style={{ marginTop: 0 }}>Pricing Health Profile</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} tickCount={3} />
                        <Radar name="This Restaurant" dataKey="value" stroke="#8b0000" fill="#8b0000" fillOpacity={0.4} />
                        <Radar name="Benchmark" dataKey="benchmark" stroke="#999" fill="#999" fillOpacity={0.15} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Tooltip
                          content={({ payload }) => {
                            if (!payload?.length) return null;
                            const d = payload[0]?.payload;
                            if (!d) return null;
                            return (
                              <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.subject}</div>
                                <div style={{ color: '#8b0000' }}>This restaurant: <strong>{d.raw}</strong></div>
                                {d.benchRaw && <div style={{ color: '#888' }}>Benchmark: {d.benchRaw}</div>}
                              </div>
                            );
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 4, lineHeight: 1.5 }}>
                      All axes scaled 0–100. BTG Coverage: 20% = 100 (≥20% saturates). Glass Markup: 0.8× = 0, 1.6× = 100. Price vs. Market: 50 = at system median.
                      {benchmarks && ` Benchmarks from ${benchmarks.restaurantCount} restaurants.`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="analytics-section">
                <div className="analytics-chart-wrap">
                  <h3 style={{ marginTop: 0 }}>Upload Activity ({from} → {to})</h3>
                  {metrics.uploadHistory.length > 0 ? (
                    <table className="analytics-history-table">
                      <thead>
                        <tr><th>Date</th><th>Type</th><th>Wines</th><th>Summary</th><th>By</th></tr>
                      </thead>
                      <tbody>
                        {metrics.uploadHistory.map((h, i) => (
                          <tr key={h.id || i}>
                            <td>{new Date(h.createdAt?.toDate ? h.createdAt.toDate() : h.createdAt).toLocaleDateString()}</td>
                            <td>{(h.uploadType || '').toUpperCase()}</td>
                            <td>{h.wineCount}</td>
                            <td>{h.summary}</td>
                            <td>{h.uploadedBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ color: '#999', fontSize: 14, padding: '20px 0' }}>No uploads in this date range.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── ENGAGEMENT TAB ── */}
      {activeTab === 'engagement' && (
        <>
          {engError && <div className="admin-error-msg" style={{ marginBottom: 16 }}>{engError}</div>}
          {engLoading && <div className="analytics-loading">Loading engagement data…</div>}
          {!engLoading && engagement && (
            <>
              {/* Summary stats */}
              <div className="analytics-stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
                <div className="analytics-stat-card">
                  <div className="analytics-stat-value">{engagement.uniqueUsers}</div>
                  <div className="analytics-stat-label">Unique Users</div>
                </div>
                <div className="analytics-stat-card">
                  <div className="analytics-stat-value">{engagement.totalEvents}</div>
                  <div className="analytics-stat-label">Total Events</div>
                </div>
                <div className="analytics-stat-card">
                  <div className="analytics-stat-value">{engagement.avgEventsPerSession ?? '—'}</div>
                  <div className="analytics-stat-label">Avg Events / Session</div>
                  <div className="analytics-stat-benchmark">engagement depth</div>
                </div>
                <div className="analytics-stat-card">
                  <div className="analytics-stat-value">{engagement.returningUsersPct ?? '—'}%</div>
                  <div className="analytics-stat-label">Returning Users</div>
                  <div className="analytics-stat-benchmark">{engagement.returningUsers} of {engagement.uniqueUsers}</div>
                </div>
              </div>

              {/* Funnel */}
              <div className="analytics-section">
                <div className="analytics-chart-wrap">
                  <h3 style={{ marginTop: 0 }}>Engagement Funnel</h3>
                  {engagement.funnel.every(s => s.count === 0) ? (
                    <div className="analytics-empty">
                      No engagement data yet — events are recorded as users interact with the app.
                    </div>
                  ) : (
                    <>
                      <div className="funnel-steps">
                        {engagement.funnel.map((step, i) => {
                          const topCount = engagement.funnel[0].count || 1;
                          const pct = Math.round((step.count / topCount) * 100);
                          return (
                            <div key={step.step} className="funnel-step">
                              <div className="funnel-step-label">
                                <span className="funnel-step-name">{step.step}</span>
                                <span className="funnel-step-count">{step.count} events · {step.users} users</span>
                              </div>
                              <div className="funnel-bar-track">
                                <div className="funnel-bar-fill" style={{ width: `${pct}%` }} />
                              </div>
                              {i < engagement.funnel.length - 1 && engagement.funnel[i + 1].users > 0 && step.users > 0 && (
                                <div className="funnel-dropoff">
                                  ↓ {Math.round((engagement.funnel[i + 1].users / step.users) * 100)}% continued
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Daily activity line chart */}
              {engagement.dailyActivity.length > 1 && (
                <div className="analytics-section">
                  <div className="analytics-chart-wrap">
                    <h3 style={{ marginTop: 0 }}>Daily Activity</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={engagement.dailyActivity}
                        margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="restaurant_view" name="Restaurant Views"
                          stroke="#8b0000" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="pairing_result_viewed" name="Results Viewed"
                          stroke="#e07b00" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="filter_applied" name="Filters Applied"
                          stroke="#999" strokeWidth={1} dot={false} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Peak activity hours */}
              {engagement.peakHours?.some(h => h.count > 0) && (
                <div className="analytics-section">
                  <div className="analytics-chart-wrap">
                    <h3 style={{ marginTop: 0 }}>Peak Activity Hours</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={engagement.peakHours}
                        margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2}
                          tickFormatter={h => h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip labelFormatter={h => h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}
                          formatter={(v) => [v, 'Events']} />
                        <Bar dataKey="count" fill="#8b0000" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Filter dimension breakdown */}
              {engagement.filterDimensions?.totalFilterEvents > 0 && (
                <div className="analytics-section">
                  <div className="analytics-chart-wrap">
                    <h3 style={{ marginTop: 0 }}>What Users Are Filtering For</h3>
                    <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 16 }}>
                      Based on {engagement.filterDimensions.totalFilterEvents} filter events. Each dimension is independent.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
                      {[
                        { title: 'Wine Type',    key: 'wineType' },
                        { title: 'By the Glass', key: 'btgOnly' },
                        { title: 'Sweetness',    key: 'sweetness' },
                        { title: 'Acidity',      key: 'acidity' },
                        { title: 'Tannins',      key: 'tannins' },
                        { title: 'Body',         key: 'bodyWeight' },
                        { title: 'Flavor Notes', key: 'flavorNotes', wide: true },
                      ].map(({ title, key, wide }) => {
                        const items = engagement.filterDimensions[key] || [];
                        const topCount = items[0]?.count || 1;
                        return (
                          <div key={title} style={wide ? { gridColumn: 'span 2' } : {}}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#8b0000', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>
                            <div style={wide ? { columns: 2, columnGap: 24 } : { display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {items.map(({ label, count }) => (
                                <div key={label} style={wide ? { breakInside: 'avoid', marginBottom: 8 } : {}}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                                    <span style={{ color: '#333', fontWeight: 500 }}>{label}</span>
                                    <span style={{ color: '#888' }}>{count}</span>
                                  </div>
                                  <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{
                                      width: `${Math.round((count / topCount) * 100)}%`,
                                      height: '100%',
                                      background: 'linear-gradient(90deg, #8b0000, #c62828)',
                                      borderRadius: 4,
                                      minWidth: count > 0 ? 4 : 0,
                                    }} />
                                  </div>
                                </div>
                              ))}
                              {items.length === 0 && (
                                <div style={{ fontSize: 12, color: '#bbb' }}>No data yet</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Top restaurants by views */}
              {engagement.topRestaurants.length > 0 && (
                <div className="analytics-section">
                  <div className="analytics-chart-wrap">
                    <h3 style={{ marginTop: 0 }}>Most Viewed Restaurants</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={engagement.topRestaurants} layout="vertical"
                        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v) => [`${v} views`, 'Views']} />
                        <Bar dataKey="views" fill="#8b0000" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Restaurant conversion table */}
              {engagement.restaurantConversionTable?.length > 0 && (
                <div className="analytics-section">
                  <div className="analytics-chart-wrap">
                    <h3 style={{ marginTop: 0 }}>Restaurant Conversion</h3>
                    <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 12 }}>
                      Highlighted rows (light red) have high views but low save rate — potential discovery friction.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="analytics-history-table">
                        <thead>
                          <tr>
                            {[
                              { key: 'name', label: 'Restaurant' },
                              { key: 'views', label: 'Views' },
                              { key: 'results', label: 'Results Viewed' },
                              { key: 'opens', label: 'Wine Opens' },
                              { key: 'saves', label: 'Saves' },
                              { key: 'conversionRate', label: 'Save Rate' },
                            ].map(col => (
                              <th key={col.key}
                                onClick={() => setConvSort(col.key)}
                                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                {col.label} {convSort === col.key ? '▼' : ''}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...engagement.restaurantConversionTable]
                            .sort((a, b) => {
                              if (convSort === 'name') return a.name.localeCompare(b.name);
                              return b[convSort] - a[convSort];
                            })
                            .map(row => (
                              <tr key={row.restaurantId}
                                style={row.views > 20 && row.conversionRate < 5 ? { background: '#fff5f5' } : {}}>
                                <td>{row.name}</td>
                                <td>{row.views}</td>
                                <td>{row.results}</td>
                                <td>{row.opens}</td>
                                <td>{row.saves}</td>
                                <td style={{ fontWeight: 600, color: row.conversionRate < 5 ? '#c62828' : '#2e7d32' }}>
                                  {row.conversionRate}%
                                </td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function PriceRangeCard({ tiers }) {
  if (!tiers) return null;
  const items = [
    { label: 'Entry  (<$75)',     count: tiers.entry },
    { label: 'Mid  ($75–$150)',   count: tiers.mid },
    { label: 'Premium  (>$150)', count: tiers.premium },
  ];
  return (
    <div className="analytics-stat-card">
      <div className="analytics-stat-label" style={{ marginBottom: 8 }}>Price Range Breadth</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, textAlign: 'left' }}>
        {items.map(item => (
          <div key={item.label} style={{ fontSize: 12, color: item.count > 0 ? '#333' : '#bbb', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{item.label}</span>
            <span style={{ fontWeight: 600, color: item.count > 0 ? '#8b0000' : '#bbb' }}>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, benchmarks, rawValue, avgKey, badge, subtitle }) {
  const avg = benchmarks?.[avgKey];
  const delta = (rawValue != null && avg != null) ? benchmarkDelta(rawValue, avg) : null;
  const hl = badge && rawValue != null ? healthLabel(rawValue) : null;

  return (
    <div className="analytics-stat-card">
      <div className="analytics-stat-value">{value}</div>
      <div className="analytics-stat-label">{label}</div>
      {hl && (
        <div style={{ marginTop: 4 }}>
          <span className={`health-score-badge ${hl}`}>
            {hl === 'good' ? 'Good' : hl === 'ok' ? 'Needs Work' : 'Poor'}
          </span>
        </div>
      )}
      {delta && (
        <div className={`analytics-stat-benchmark ${delta.better ? 'better' : 'worse'}`}>
          {delta.label}
        </div>
      )}
      {subtitle && <div className="analytics-stat-benchmark">{subtitle}</div>}
    </div>
  );
}
