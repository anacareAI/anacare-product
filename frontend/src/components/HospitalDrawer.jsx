import { useState, useEffect } from 'react'
import { apiFetch } from '../api'
import SurgeonCards from './SurgeonCards'

const PHASES = [
  {
    key: 'preop',
    title: 'Phase 1 — Before Surgery',
    itemsKey: 'preop_items',
    totalKey: 'preop_oop',
    borderColor: 'var(--accent)',
  },
  {
    key: 'surgery',
    title: 'Phase 2 — Surgery',
    itemsKey: 'surgery_items',
    totalKey: 'surgery_oop',
    borderColor: '#7C3AED',
  },
  {
    key: 'postop',
    title: 'Phase 3 — After Surgery',
    itemsKey: 'postop_items',
    totalKey: 'postop_oop',
    borderColor: 'var(--accent)',
  },
]

function formatDollarsHeadline(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return '$0'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function formatDollarsDetailed(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return '$0.00'
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function useViewportWidth() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 720,
  )

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return width
}

function PhaseSection({ title, borderColor, items, phaseTotal }) {
  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  }
  const thStyle = {
    textAlign: 'left',
    padding: '6px 8px',
    color: 'var(--text-3)',
    fontWeight: 400,
    borderBottom: '1px solid var(--border)',
  }
  const tdStyle = { padding: '6px 8px' }

  return (
    <section
      style={{
        marginTop: '20px',
        borderLeft: `4px solid ${borderColor}`,
        paddingLeft: '12px',
      }}
    >
      <h3
        style={{
          margin: '0 0 10px',
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text)',
        }}
      >
        {title}
      </h3>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Item</th>
            <th style={thStyle}>CPT</th>
            <th style={thStyle}>Qty</th>
            <th style={thStyle}>Gross</th>
            <th style={thStyle}>Your Cost</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((row, i) => (
            <tr
              key={`${row.name}-${row.cpt}-${i}`}
              style={{
                background: i % 2 === 1 ? 'var(--surface-2)' : 'transparent',
              }}
            >
              <td style={tdStyle}>{row.name}</td>
              <td style={tdStyle}>{row.cpt}</td>
              <td style={tdStyle}>{row.qty}</td>
              <td style={tdStyle}>{formatDollarsDetailed(row.gross_cost)}</td>
              <td style={tdStyle}>{formatDollarsDetailed(row.your_cost)}</td>
            </tr>
          ))}
          <tr>
            <td
              colSpan={4}
              style={{
                ...tdStyle,
                fontWeight: 500,
                borderTop: '1px solid var(--border)',
              }}
            >
              Phase total
            </td>
            <td
              style={{
                ...tdStyle,
                fontWeight: 500,
                borderTop: '1px solid var(--border)',
              }}
            >
              {formatDollarsDetailed(phaseTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

export default function HospitalDrawer({
  ccn,
  hospitalName,
  cptCode,
  planId,
  deductibleRemaining,
  oopMaxRemaining,
  isOpen,
  onClose,
}) {
  const viewportWidth = useViewportWidth()
  const drawerWidth = viewportWidth < 600 ? '100%' : 520

  const [episodeData, setEpisodeData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [showTimeline, setShowTimeline] = useState(false)
  const [estimateMode, setEstimateMode] = useState('base')

  useEffect(() => {
    if (!isOpen || !ccn || !cptCode) return undefined

    const params = new URLSearchParams({
      cpt_code: cptCode,
      deductible: String(deductibleRemaining ?? 0),
      oop_max: String(oopMaxRemaining ?? 99999),
    })
    if (planId) params.set('plan_id', planId)

    const path = `/providers/${encodeURIComponent(ccn)}/episode?${params.toString()}`
    let cancelled = false

    setEpisodeData(null)
    setLoadError(null)

    apiFetch(path)
      .then((data) => {
        if (!cancelled) setEpisodeData(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || 'Failed to load episode')
      })

    return () => {
      cancelled = true
    }
  }, [
    isOpen,
    ccn,
    cptCode,
    planId,
    deductibleRemaining,
    oopMaxRemaining,
  ])

  useEffect(() => {
    if (!isOpen) {
      setShowTimeline(false)
      setEstimateMode('base')
    }
  }, [isOpen])

  const drawerStyle = {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '100vh',
    width: drawerWidth,
    background: 'var(--surface)',
    borderLeft: '1px solid var(--border)',
    zIndex: 300,
    overflowY: 'auto',
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition:
      'transform 260ms ease, background 200ms ease, border-color 200ms ease',
    padding: '24px',
    pointerEvents: isOpen ? 'auto' : 'none',
    boxSizing: 'border-box',
  }

  const backdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'var(--overlay)',
    zIndex: 299,
  }

  const activeEpisode =
    estimateMode === 'complication' && episodeData?.complication_episode
      ? episodeData.complication_episode
      : episodeData?.episode

  const hasComplicationData =
    episodeData?.complication_episode != null &&
    episodeData?.complication_rate != null &&
    episodeData?.complication_national_avg != null

  const pillBase = {
    fontSize: '12px',
    padding: '6px 14px',
    borderRadius: '999px',
    border: '1px solid var(--border-hover)',
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--text-2)',
    transition: 'background 150ms, color 150ms, border-color 150ms',
  }

  const pillActive = {
    ...pillBase,
    background: 'var(--surface-2)',
    borderColor: 'var(--accent)',
    color: 'var(--text)',
  }

  return (
    <>
      {isOpen ? (
        <div
          style={backdropStyle}
          onClick={onClose}
          role="presentation"
          aria-hidden={!isOpen}
        />
      ) : null}

      <aside style={drawerStyle} aria-hidden={!isOpen}>
        {loadError ? (
          <p style={{ color: 'var(--red)', fontSize: '14px' }}>{loadError}</p>
        ) : null}

        {!episodeData && !loadError && isOpen ? (
          <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>Loading…</p>
        ) : null}

        {episodeData && activeEpisode ? (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontWeight: 500,
                  fontSize: '18px',
                  color: 'var(--text)',
                }}
              >
                {hospitalName}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  fontSize: '24px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '4px 8px',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginTop: '24px' }}>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Your Estimated Episode Cost
              </div>
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 300,
                  color: 'var(--accent)',
                  marginTop: '6px',
                }}
              >
                {formatDollarsHeadline(activeEpisode.total_episode_oop)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTimeline((v) => !v)}
              style={{
                marginTop: '12px',
                padding: 0,
                border: 'none',
                background: 'none',
                fontSize: '13px',
                color: 'var(--accent)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              How we calculated this{' '}
              <span aria-hidden>{showTimeline ? '▲' : '▼'}</span>
            </button>

            {showTimeline
              ? PHASES.map((p) => (
                  <PhaseSection
                    key={p.key}
                    title={p.title}
                    borderColor={p.borderColor}
                    items={activeEpisode[p.itemsKey]}
                    phaseTotal={activeEpisode[p.totalKey]}
                  />
                ))
              : null}

            {hasComplicationData ? (
              <div style={{ marginTop: '20px' }}>
                <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text)' }}>
                  Complication rate:{' '}
                  {Number(episodeData.complication_rate).toFixed(1)}% at this
                  hospital vs{' '}
                  {Number(episodeData.complication_national_avg).toFixed(1)}%
                  national avg
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setEstimateMode('base')}
                    style={estimateMode === 'base' ? pillActive : pillBase}
                  >
                    Base estimate
                  </button>
                  <button
                    type="button"
                    onClick={() => setEstimateMode('complication')}
                    style={
                      estimateMode === 'complication' ? pillActive : pillBase
                    }
                  >
                    + Complication risk
                  </button>
                </div>
              </div>
            ) : null}

            <details
              style={{
                marginTop: '16px',
                fontSize: '13px',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  color: 'var(--text-2)',
                  padding: '8px 0',
                }}
              >
                {`What's included in this estimate`}
              </summary>
              <ul
                style={{
                  paddingLeft: '20px',
                  color: 'var(--text-2)',
                  lineHeight: 1.8,
                  margin: '8px 0 0',
                }}
              >
                <li>Surgeon and facility fees</li>
                <li>Anesthesia</li>
                <li>Pre-operative labs and imaging</li>
                <li>Post-operative physical therapy</li>
                <li>Prescription medications</li>
                <li>Durable medical equipment</li>
              </ul>
            </details>

            <details
              style={{
                marginTop: '16px',
                fontSize: '13px',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  color: 'var(--text-2)',
                  padding: '8px 0',
                }}
              >
                Not included in this estimate
              </summary>
              <ul
                style={{
                  paddingLeft: '20px',
                  color: 'var(--text-2)',
                  lineHeight: 1.8,
                  margin: '8px 0 0',
                }}
              >
                <li>Unexpected complications or readmissions</li>
                <li>Out-of-network charges</li>
                <li>Non-surgical treatments</li>
                <li>Travel and lodging</li>
                <li>Lost wages</li>
              </ul>
            </details>

            <p
              style={{
                fontStyle: 'italic',
                fontSize: '11px',
                color: 'var(--text-3)',
                marginTop: '16px',
                lineHeight: 1.5,
              }}
            >
              {`Cost estimates are based on CMS negotiated rate data and your plan's cost-sharing rules. Actual costs may vary. Not a guarantee of payment.`}
            </p>

            <div style={{ marginTop: '24px' }}>
              <SurgeonCards ccn={ccn} cptCode={cptCode} />
            </div>
          </>
        ) : null}
      </aside>
    </>
  )
}
