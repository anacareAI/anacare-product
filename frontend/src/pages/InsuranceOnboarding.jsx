import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { INSURANCE_CARRIERS, INSURANCE_PLANS } from '../data/insurancePlans'

const CARRIERS = [
  { id: 'no_insurance', name: 'No Insurance / Cash Pay', color: '#6b7280', plans: [] },
  ...INSURANCE_CARRIERS.map((c) => ({
    ...c,
    plans: INSURANCE_PLANS[c.id] || [],
  })),
]

function metalTier(plan) {
  const name = plan.name.toLowerCase()
  if (name.includes('platinum')) return { label: 'Platinum', color: '#6366f1' }
  if (name.includes('gold')) return { label: 'Gold', color: '#ca8a04' }
  if (name.includes('silver')) return { label: 'Silver', color: '#64748b' }
  if (name.includes('bronze')) return { label: 'Bronze', color: '#b45309' }
  if (name.includes('hdhp') || name.includes('hsa')) return { label: 'HDHP', color: '#0891b2' }
  return { label: plan.type, color: 'var(--text-3)' }
}

export default function InsuranceOnboarding() {
  const navigate = useNavigate()
  const { user } = useUser()
  const [step, setStep] = useState('carrier') // carrier | plan | details
  const [selectedCarrier, setSelectedCarrier] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [deductible, setDeductible] = useState('')
  const [oopMax, setOopMax] = useState('')
  const [coinsurance, setCoinsurance] = useState('')
  const [deductibleMet, setDeductibleMet] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (selectedPlan) {
      setDeductible(String(selectedPlan.ded))
      setOopMax(String(selectedPlan.oop))
      setCoinsurance(String(selectedPlan.coins))
      setDeductibleMet('')
    }
  }, [selectedPlan])

  function handleSelectCarrier(carrier) {
    setSelectedCarrier(carrier)
    if (carrier.id === 'no_insurance') {
      saveInsurance({ isCashPay: true })
      return
    }
    setStep('plan')
  }

  function handleSelectPlan(plan) {
    setSelectedPlan(plan)
    setStep('details')
  }

  async function saveInsurance(data) {
    setSaving(true)
    try {
      const payload = data || {
        carrier: selectedCarrier?.name,
        plan_id: selectedPlan?.id,
        plan_name: selectedPlan?.name,
        plan_type: selectedPlan?.type,
        deductible: parseInt(deductible) || 0,
        oop_max: parseInt(oopMax) || 0,
        coinsurance_pct: (parseInt(coinsurance) || 20) / 100,
        deductible_met: parseInt(deductibleMet) || 0,
        isCashPay: false,
      }
      // Persist to Clerk user metadata
      if (user) {
        await user.update({
          unsafeMetadata: {
            ...user.unsafeMetadata,
            insurance: payload,
          },
        })
      }
      // Also persist to localStorage as fallback
      localStorage.setItem('anacare:insurance', JSON.stringify(payload))
      navigate('/home')
    } catch (err) {
      console.error('Failed to save insurance:', err)
      // Still navigate on error - localStorage will have the data
      const payload = data || {
        carrier: selectedCarrier?.name,
        plan_id: selectedPlan?.id,
        plan_name: selectedPlan?.name,
        plan_type: selectedPlan?.type,
        deductible: parseInt(deductible) || 0,
        oop_max: parseInt(oopMax) || 0,
        coinsurance_pct: (parseInt(coinsurance) || 20) / 100,
        deductible_met: parseInt(deductibleMet) || 0,
        isCashPay: false,
      }
      localStorage.setItem('anacare:insurance', JSON.stringify(payload))
      navigate('/home')
    } finally {
      setSaving(false)
    }
  }

  const carrier = selectedCarrier
  const plans = carrier?.plans || []

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '48px 20px',
    }}>
      <style>{`
        .onb-card {
          width: 100%;
          max-width: 640px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          box-shadow: var(--shadow-lg);
          padding: 32px 28px;
          animation: onb-fade-in 0.3s ease;
        }
        @keyframes onb-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .onb-carrier-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          background: var(--surface-2);
          border: 1.5px solid var(--border);
          border-radius: 14px;
          cursor: pointer;
          font-family: inherit;
          transition: all 180ms ease;
        }
        .onb-carrier-btn:hover {
          border-color: var(--accent);
          background: var(--surface);
          box-shadow: 0 0 0 3px var(--accent-soft);
          transform: translateY(-1px);
        }
        .onb-plan-btn {
          width: 100%;
          text-align: left;
          padding: 16px 18px;
          background: var(--surface-2);
          border: 1.5px solid var(--border);
          border-radius: 14px;
          cursor: pointer;
          font-family: inherit;
          transition: all 180ms ease;
        }
        .onb-plan-btn:hover {
          border-color: var(--accent);
          background: var(--surface);
          box-shadow: 0 0 0 3px var(--accent-soft);
          transform: translateY(-1px);
        }
        .onb-input-group {
          display: grid;
          gap: 6px;
        }
        .onb-input-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-2);
        }
        .onb-input {
          width: 100%;
          box-sizing: border-box;
          padding: 14px 16px;
          background: var(--surface-2);
          border: 1.5px solid var(--border);
          border-radius: 12px;
          font-size: 16px;
          font-family: inherit;
          color: var(--text);
          outline: none;
          transition: border-color 180ms ease, box-shadow 180ms ease;
        }
        .onb-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .onb-primary-btn {
          width: 100%;
          padding: 16px 24px;
          background: var(--accent);
          color: var(--accent-text);
          border: none;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 180ms ease;
        }
        .onb-primary-btn:hover:not(:disabled) {
          background: var(--accent-hover);
          transform: translateY(-1px);
        }
        .onb-primary-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .onb-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 0;
          background: none;
          border: none;
          color: var(--text-3);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          transition: color 150ms ease;
        }
        .onb-back-btn:hover { color: var(--text); }
        .onb-step-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
        }
        .onb-step-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transition: all 200ms ease;
        }
        .onb-step-dot.active { width: 24px; border-radius: 4px; }
        @media (max-width: 640px) {
          .onb-card { padding: 24px 18px; border-radius: 16px; }
        }
      `}</style>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="var(--green)" />
          <path d="M16 8c-2.8 0-5 2.1-5 4.7 0 4.2 5 9.3 5 9.3s5-5.1 5-9.3C21 10.1 18.8 8 16 8zm0 6.6a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8z" fill="var(--accent-text)" />
        </svg>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--accent)' }}>AnaCare</span>
      </div>

      <div className="onb-card">
        {/* Step indicator */}
        <div className="onb-step-indicator">
          {['carrier', 'plan', 'details'].map((s) => (
            <div
              key={s}
              className={`onb-step-dot ${s === step ? 'active' : ''}`}
              style={{ background: s === step ? 'var(--accent)' : 'var(--border)' }}
            />
          ))}
        </div>

        {step === 'carrier' && (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
              Select your insurance carrier
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.5 }}>
              This helps us estimate your out-of-pocket costs accurately.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {CARRIERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="onb-carrier-btn"
                  onClick={() => handleSelectCarrier(c)}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: c.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0,
                  }}>
                    {c.id === 'no_insurance' ? '$' : c.name[0]}
                  </div>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: 'var(--text)', textAlign: 'left' }}>
                    {c.name}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate('/home')}
              style={{
                marginTop: 20,
                width: '100%',
                padding: '12px',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--text-2)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Skip for now
            </button>
          </>
        )}

        {step === 'plan' && carrier && (
          <>
            <button type="button" className="onb-back-btn" onClick={() => { setStep('carrier'); setSelectedCarrier(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
              Select your {carrier.name} plan
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.5 }}>
              Choose the plan that matches your current coverage.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {plans.map((p) => {
                const tier = metalTier(p)
                return (
                  <button key={p.id} type="button" className="onb-plan-btn" onClick={() => handleSelectPlan(p)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{p.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-2)' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6,
                        background: tier.color + '18', color: tier.color, fontWeight: 600, fontSize: 11,
                      }}>
                        {tier.label}
                      </span>
                      <span>${p.ded.toLocaleString()} deductible</span>
                      <span>${p.oop.toLocaleString()} OOP max</span>
                      <span>{p.coins}% coinsurance</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 'details' && selectedPlan && (
          <>
            <button type="button" className="onb-back-btn" onClick={() => { setStep('plan'); setSelectedPlan(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
              Confirm your plan details
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 6, lineHeight: 1.5 }}>
              We pre-filled your plan defaults. Adjust if your values differ.
            </p>
            <div style={{
              padding: '12px 16px', background: 'var(--accent-soft)', borderRadius: 12,
              marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: carrier.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
              }}>
                {carrier.name[0]}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{selectedPlan.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{carrier.name} · {selectedPlan.type}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div className="onb-input-group">
                <label className="onb-input-label">Deductible</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 16 }}>$</span>
                  <input type="number" className="onb-input" style={{ paddingLeft: 28 }} value={deductible} onChange={(e) => setDeductible(e.target.value)} />
                </div>
              </div>
              <div className="onb-input-group">
                <label className="onb-input-label">OOP Maximum</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 16 }}>$</span>
                  <input type="number" className="onb-input" style={{ paddingLeft: 28 }} value={oopMax} onChange={(e) => setOopMax(e.target.value)} />
                </div>
              </div>
              <div className="onb-input-group">
                <label className="onb-input-label">Coinsurance</label>
                <div style={{ position: 'relative' }}>
                  <input type="number" className="onb-input" style={{ paddingRight: 28 }} value={coinsurance} onChange={(e) => setCoinsurance(e.target.value)} />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 16 }}>%</span>
                </div>
              </div>
              <div className="onb-input-group">
                <label className="onb-input-label">Deductible already met this year</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 16 }}>$</span>
                  <input type="number" className="onb-input" style={{ paddingLeft: 28 }} value={deductibleMet} onChange={(e) => setDeductibleMet(e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>

            <button
              type="button"
              className="onb-primary-btn"
              disabled={saving}
              onClick={() => saveInsurance()}
            >
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/home')}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '12px',
                background: 'none',
                border: 'none',
                color: 'var(--text-3)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Skip for now
            </button>
          </>
        )}
      </div>
    </div>
  )
}
