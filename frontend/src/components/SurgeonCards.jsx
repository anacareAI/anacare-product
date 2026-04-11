import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

export default function SurgeonCards({ ccn, cptCode }) {
  const [surgeons, setSurgeons] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ccn || !cptCode) return
    let cancelled = false
    setLoading(true)
    apiFetch(`/providers/${encodeURIComponent(ccn)}/surgeons?cpt_code=${encodeURIComponent(cptCode)}`)
      .then((data) => {
        if (!cancelled) setSurgeons(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setSurgeons([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [ccn, cptCode])

  if (loading) {
    return <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading surgeons…</p>
  }

  if (!surgeons.length) return null

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>
        Surgeons at this facility
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {surgeons.map((s) => (
          <div
            key={s.npi}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 14px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--accent)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {(s.name || '')
                .split(',')[0]
                .charAt(0)
                .toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                {s.name}
                {s.credentials ? (
                  <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 4 }}>
                    {s.credentials}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                {s.specialty || 'Surgery'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {s.annual_volume > 0 ? (
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-2)',
                    }}
                  >
                    {s.annual_volume} procedures/yr
                  </span>
                ) : null}
                {s.years_in_practice != null && s.years_in_practice > 0 ? (
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-2)',
                    }}
                  >
                    {s.years_in_practice} yrs experience
                  </span>
                ) : null}
                {s.top_performer ? (
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent)',
                      color: 'var(--accent)',
                      fontWeight: 500,
                    }}
                  >
                    Top performer
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
