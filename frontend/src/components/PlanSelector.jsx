import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { INSURANCE_CARRIERS, INSURANCE_PLANS } from '../data/insurancePlans'

const CARRIERS = INSURANCE_CARRIERS
const PLANS = INSURANCE_PLANS

const HOME_PILL = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 12,
  padding: '11px 14px 11px 12px',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 999,
  cursor: 'pointer',
  fontFamily: 'inherit',
  maxWidth: '100%',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 14px rgba(15, 23, 42, 0.06)',
  transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
}

export default function PlanSelector({
  onChange,
  directOpen = false,
  initialSelection = null,
  openBenefitsOnMount = false,
  variant = 'default',
}) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [isOpen, setIsOpen] = useState(false)
  const [selectedCarrier, setSelectedCarrier] = useState(null)
  const [expandedCarrierId, setExpandedCarrierId] = useState(null)
  const [nestedPlanSearch, setNestedPlanSearch] = useState('')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [isCashPay, setIsCashPay] = useState(false)
  const [dedVal, setDedVal] = useState('')
  const [oopVal, setOopVal] = useState('')
  const [coinsVal, setCoinsVal] = useState('')
  const [dedMetVal, setDedMetVal] = useState('')
  const [oopRemainingVal, setOopRemainingVal] = useState('')
  const [showBenefits, setShowBenefits] = useState(false)
  const [showBenefitsHelp, setShowBenefitsHelp] = useState(false)
  /** Which benefits grid field has its inline help open (key), or null. */
  const [benefitsFieldHelp, setBenefitsFieldHelp] = useState(null)
  /** Home: user pressed Submit in the plan-details modal (vs still drafting or cancelled). */
  const [benefitsSubmitted, setBenefitsSubmitted] = useState(false)
  const containerRef = useRef(null)
  /** True after user picks a plan from the list or changes plan in the modal — skip auto "submitted" when parent syncs from onChange. */
  const userPickedPlanFromListRef = useRef(false)
  const [searchQuery, setSearchQuery] = useState('')

  function applyPlanFieldsFromPlan(plan) {
    setDedVal(String(plan.ded))
    setOopVal(String(plan.oop))
    setCoinsVal(String(plan.coins))
    setDedMetVal('')
    setOopRemainingVal(String(plan.oop))
  }

  const closeBenefits = () => {
    setBenefitsFieldHelp(null)
    setShowBenefitsHelp(false)
    setShowBenefits(false)
    setIsOpen(false)
    setExpandedCarrierId(null)
    setNestedPlanSearch('')
  }

  const closeInsurancePicker = () => {
    setIsOpen(false)
    setSearchQuery('')
    setExpandedCarrierId(null)
    setNestedPlanSearch('')
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (directOpen) return
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setExpandedCarrierId(null)
        setNestedPlanSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [directOpen])

  useEffect(() => {
    if (!benefitsFieldHelp) return
    function onDocDown(e) {
      const root = e.target.closest('[data-benefit-help-root]')
      if (root && root.getAttribute('data-benefit-help-root') === benefitsFieldHelp) return
      setBenefitsFieldHelp(null)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [benefitsFieldHelp])

  useEffect(() => {
    if (directOpen) return
    if (!isOpen && !expandedCarrierId && !(showBenefits && selectedPlan)) return
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (showBenefits && selectedPlan) {
        closeBenefits()
        return
      }
      if (expandedCarrierId) {
        setExpandedCarrierId(null)
        setNestedPlanSearch('')
        return
      }
      if (isOpen) {
        setIsOpen(false)
        setSearchQuery('')
        setExpandedCarrierId(null)
        setNestedPlanSearch('')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [directOpen, isOpen, expandedCarrierId, showBenefits, selectedPlan])

  useEffect(() => {
    if (directOpen) setIsOpen(true)
  }, [directOpen])

  useEffect(() => {
    if (!initialSelection) {
      userPickedPlanFromListRef.current = false
      setBenefitsSubmitted(false)
      return
    }

    if (initialSelection.isCashPay) {
      setIsCashPay(true)
      setSelectedCarrier(null)
      setSelectedPlan(null)
      setShowBenefits(false)
      setBenefitsSubmitted(false)
      return
    }

    if (initialSelection.plan_id) {
      for (const [carrierId, plans] of Object.entries(PLANS)) {
        const matched = plans.find(p => p.id === initialSelection.plan_id)
        if (matched) {
          setSelectedCarrier(carrierId)
          setSelectedPlan(matched)
          setIsCashPay(false)
          if (!userPickedPlanFromListRef.current) setShowBenefits(false)
          if (variant === 'home' && !userPickedPlanFromListRef.current) {
            setBenefitsSubmitted(true)
          }
          setDedVal(String(matched.ded))
          setOopVal(String(matched.oop))
          setCoinsVal(String(matched.coins))
          if (initialSelection.coinsurance_pct != null) {
            setCoinsVal(String(Math.round(initialSelection.coinsurance_pct * 100)))
          }
          {
            const dr = initialSelection.deductible_remaining
            const d = matched.ded
            setDedMetVal(
              dr == null ? '0' : String(Math.max(0, d - Number(dr))),
            )
          }
          setOopRemainingVal(
            String(initialSelection.oop_max_remaining ?? matched.oop),
          )
          return
        }
      }
      // DB/API plan id — not in static PLANS; still allow benefits editing
      const pl = initialSelection.plan
      if (pl) {
        const coinsPct =
          initialSelection.coinsurance_pct != null
            ? Math.round(Number(initialSelection.coinsurance_pct) * 100)
            : 20
        setSelectedPlan({
          id: initialSelection.plan_id,
          name: pl.plan_name || 'Your plan',
          type: pl.network_type || 'PPO',
          ded: Number(pl.deductible) || 1500,
          oop: Number(pl.oop_max) || 6500,
          coins: coinsPct,
          copay: Number(initialSelection.pc_copay) || 40,
        })
        setIsCashPay(false)
        if (!userPickedPlanFromListRef.current) setShowBenefits(false)
        if (variant === 'home' && !userPickedPlanFromListRef.current) {
          setBenefitsSubmitted(true)
        }
        const payerLower = (pl.payer || '').toLowerCase()
        const hit = CARRIERS.find(
          (c) =>
            payerLower.includes(c.name.toLowerCase()) ||
            (payerLower.length > 0 && c.name.toLowerCase().includes(payerLower.split(/\s+/)[0])),
        )
        setSelectedCarrier(hit ? hit.id : null)
        setDedVal(String(pl.deductible ?? 1500))
        setOopVal(String(pl.oop_max ?? 6500))
        setCoinsVal(String(coinsPct))
        {
          const d = Number(pl.deductible) || 0
          const dr = initialSelection.deductible_remaining
          setDedMetVal(dr == null ? '0' : String(Math.max(0, d - Number(dr))))
        }
        setOopRemainingVal(String(initialSelection.oop_max_remaining ?? pl.oop_max ?? 0))
        return
      }
      setSelectedPlan({
        id: initialSelection.plan_id,
        name: 'Your plan',
        type: 'PPO',
        ded: 1500,
        oop: 6500,
        coins: 20,
        copay: 40,
      })
      setIsCashPay(false)
      if (!userPickedPlanFromListRef.current) setShowBenefits(false)
      if (variant === 'home' && !userPickedPlanFromListRef.current) {
        setBenefitsSubmitted(true)
      }
      setSelectedCarrier(null)
      setDedVal('1500')
      setOopVal('6500')
      setCoinsVal('20')
      {
        const d = 1500
        const dr = initialSelection.deductible_remaining
        setDedMetVal(dr == null ? '0' : String(Math.max(0, d - Number(dr))))
      }
      setOopRemainingVal(String(initialSelection.oop_max_remaining ?? 6500))
    }
  }, [initialSelection, variant])

  useEffect(() => {
    if (!openBenefitsOnMount || !selectedPlan) return
    setShowBenefits(true)
    if (!directOpen) setIsOpen(true)
  }, [openBenefitsOnMount, selectedPlan, directOpen])

  useEffect(() => {
    if (typeof onChangeRef.current !== 'function') return

    if (isCashPay) {
      onChangeRef.current({
        plan_id: null,
        plan: null,
        deductible_remaining: 0,
        oop_max_remaining: 99999,
        coinsurance_pct: 1.0,
        isCashPay: true,
      })
      return
    }

    const ded = Math.max(0, parseInt(dedVal, 10) || 0)
    const oop = Math.max(0, parseInt(oopVal, 10) || 0)
    const coinsRaw = parseInt(coinsVal, 10)
    const coins = Number.isNaN(coinsRaw) ? 20 : Math.min(100, Math.max(0, coinsRaw))
    const copay = Math.max(0, Number(selectedPlan?.copay ?? 40))
    const dedMetRaw = Math.max(0, parseInt(dedMetVal, 10) || 0)
    const dedMet = Math.min(dedMetRaw, ded, oop)
    const dedRemaining = Math.max(0, ded - dedMet)
    const oopRemRaw = Math.max(0, parseInt(oopRemainingVal, 10) || 0)
    const oopRemaining = Math.min(oopRemRaw, oop)

    const carrier = CARRIERS.find(c => c.id === selectedCarrier)
    const payerName =
      carrier?.name || initialSelection?.plan?.payer || (typeof selectedCarrier === 'string' ? selectedCarrier : null)

    onChangeRef.current({
      plan_id: selectedPlan?.id || null,
      plan: selectedPlan
        ? {
            payer: payerName || 'Insurance',
            plan_name: selectedPlan.name,
            network_type: selectedPlan.type,
            deductible: ded,
            oop_max: oop,
            copay,
          }
        : null,
      deductible_remaining: dedRemaining,
      oop_max_remaining: oopRemaining,
      coinsurance_pct: coins / 100,
      pc_copay: copay,
    })
  }, [selectedCarrier, selectedPlan, dedVal, oopVal, coinsVal, dedMetVal, oopRemainingVal, isCashPay, initialSelection])

  const handleSelectCarrier = (carrierId) => {
    userPickedPlanFromListRef.current = true
    const plans = PLANS[carrierId] || []
    // One-click selection behavior: choose first available plan and close immediately.
    const defaultPlan = plans[0] || null
    setSelectedCarrier(carrierId)
    setSelectedPlan(defaultPlan)
    setIsCashPay(false)
    if (defaultPlan) {
      applyPlanFieldsFromPlan(defaultPlan)
    }
    setExpandedCarrierId(null)
    setNestedPlanSearch('')
    setSearchQuery('')
    if (variant === 'home' && !directOpen && defaultPlan) {
      setBenefitsSubmitted(false)
      setShowBenefits(true)
      setIsOpen(false)
    } else {
      setShowBenefits(false)
      setIsOpen(false)
    }
  }

  const handleSelectPlan = (plan, carrierId) => {
    userPickedPlanFromListRef.current = true
    if (carrierId) setSelectedCarrier(carrierId)
    setSelectedPlan(plan)
    applyPlanFieldsFromPlan(plan)
    setExpandedCarrierId(null)
    setNestedPlanSearch('')
    setSearchQuery('')
    if (variant === 'home') setBenefitsSubmitted(false)
    if (variant === 'home' && !directOpen) {
      setShowBenefits(true)
      setIsOpen(false)
    } else {
      setShowBenefits(false)
      setIsOpen(false)
    }
  }

  const handleHomeCarrierChange = (carrierId) => {
    userPickedPlanFromListRef.current = true
    if (!carrierId) return
    const plans = PLANS[carrierId] || []
    const first = plans[0]
    if (!first) return
    setSelectedCarrier(carrierId)
    setSelectedPlan(first)
    applyPlanFieldsFromPlan(first)
    setBenefitsSubmitted(false)
  }

  const handleHomePlanChange = (planId) => {
    userPickedPlanFromListRef.current = true
    if (!selectedCarrier || !planId) return
    const plan = (PLANS[selectedCarrier] || []).find((p) => String(p.id) === String(planId))
    if (!plan) return
    setSelectedPlan(plan)
    applyPlanFieldsFromPlan(plan)
    setBenefitsSubmitted(false)
  }

  const handleCashPay = () => {
    setIsCashPay(true)
    setSelectedCarrier(null)
    setSelectedPlan(null)
    setIsOpen(false)
    setExpandedCarrierId(null)
    setNestedPlanSearch('')
    setShowBenefits(false)
    setBenefitsSubmitted(false)
    userPickedPlanFromListRef.current = false
  }

  const handleClearSelection = (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    setSelectedCarrier(null)
    setSelectedPlan(null)
    setIsCashPay(false)
    setShowBenefits(false)
    setBenefitsSubmitted(false)
    userPickedPlanFromListRef.current = false
    setIsOpen(false)
    setExpandedCarrierId(null)
    setNestedPlanSearch('')
    if (typeof onChangeRef.current === 'function') {
      onChangeRef.current(null)
    }
  }

  const carrier = CARRIERS.find(c => c.id === selectedCarrier)

  const filteredCarriers = searchQuery
    ? CARRIERS.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : CARRIERS

  const dedMetNum = Math.max(0, parseInt(dedMetVal, 10) || 0)
  const dedNum = Math.max(0, parseInt(dedVal, 10) || 0)
  const oopNum = Math.max(0, parseInt(oopVal, 10) || 0)
  const oopRemNum = Math.max(0, parseInt(oopRemainingVal, 10) || 0)
  const coinsParsed = parseInt(coinsVal, 10)
  const invalidDeductibleMet = dedMetNum > dedNum || dedMetNum > oopNum
  const invalidOopRemaining = oopNum > 0 && oopRemNum > oopNum
  const invalidCoins =
    coinsVal.trim() !== '' &&
    (Number.isNaN(coinsParsed) || coinsParsed < 0 || coinsParsed > 100)
  const benefitsSaveBlocked = invalidDeductibleMet || invalidOopRemaining || invalidCoins

  const submitBenefitsModal = () => {
    if (benefitsSaveBlocked) return
    if (variant === 'home') {
      setBenefitsSubmitted(true)
      userPickedPlanFromListRef.current = false
    }
    closeBenefits()
  }

  /** Home: always use overlay modal when editing benefits; other variants keep prior isOpen-gated behavior. */
  const benefitsUseModalShell =
    Boolean(showBenefits && selectedPlan && !directOpen && (variant === 'home' || isOpen))

  useEffect(() => {
    if (!benefitsUseModalShell || !showBenefits || !selectedPlan) return
    const html = document.documentElement
    const prevBody = document.body.style.overflow
    const prevHtml = html.style.overflow
    const y = window.scrollY
    document.body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      html.style.overflow = prevHtml
      window.scrollTo(0, y)
    }
  }, [benefitsUseModalShell, showBenefits, selectedPlan])

  const pickerPanelStyle = directOpen
    ? {
      position: 'relative',
      width: '100%',
      background: 'var(--surface)',
      maxHeight: 'min(56vh, 480px)',
      overflowY: 'auto',
      borderRadius: 'var(--radius-lg)',
    }
    : variant === 'home'
      ? {
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          top: '100%',
          marginTop: 10,
          width: 'min(380px, calc(100vw - 32px))',
          zIndex: 1200,
          background: '#ffffff',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          borderRadius: 16,
          boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 20px 40px -12px rgba(15, 23, 42, 0.12)',
          maxHeight: 'min(72vh, 520px)',
          overflowY: 'auto',
        }
      : {
          position: 'absolute',
          left: 0,
          right: 0,
          top: '100%',
          marginTop: 6,
          zIndex: 1200,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: 'min(72vh, 520px)',
          overflowY: 'auto',
        }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: variant === 'home' ? '100%' : undefined,
        maxWidth: variant === 'home' ? 440 : undefined,
        marginLeft: variant === 'home' ? 'auto' : undefined,
        marginRight: variant === 'home' ? 'auto' : undefined,
        display: variant === 'home' ? 'flex' : undefined,
        flexDirection: variant === 'home' ? 'column' : undefined,
        alignItems: variant === 'home' ? 'center' : undefined,
      }}
    >
      {(selectedPlan || isCashPay) && !isOpen && !directOpen && variant === 'home' && !showBenefits && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setExpandedCarrierId(null)
              setNestedPlanSearch('')
              if (isCashPay) {
                setIsOpen(true)
                return
              }
              if (selectedPlan) {
                setShowBenefits(true)
                if (!directOpen) setIsOpen(false)
              }
            }}
            style={HOME_PILL}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(45, 90, 61, 0.12)'
              e.currentTarget.style.borderColor = '#cbd5e1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = HOME_PILL.boxShadow
              e.currentTarget.style.borderColor = '#e2e8f0'
            }}
          >
            {isCashPay ? (
              <>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: '#2d5a3d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>Cash pay</span>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: carrier?.color || '#2d5a3d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {(carrier?.name || '?')[0]}
                </div>
                <div style={{ textAlign: 'left', minWidth: 0, maxWidth: 220 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', lineHeight: 1.3 }}>{selectedPlan.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{selectedPlan.type}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontWeight: 500, letterSpacing: '0.02em' }}>
                    {benefitsSubmitted
                      ? 'Saved — change details anytime'
                      : 'Open the modal, confirm amounts, then Submit'}
                  </div>
                </div>
              </>
            )}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#2d5a3d',
                marginLeft: 6,
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(45, 90, 61, 0.35)',
              }}
              aria-hidden
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="10 8 16 12 10 16" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            onMouseDown={handleClearSelection}
            onClick={handleClearSelection}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#888',
              fontSize: 18,
              lineHeight: 1,
              padding: '4px 6px',
            }}
            aria-label="Clear insurance selection"
          >
            ×
          </button>
        </div>
        {selectedPlan && !isCashPay && benefitsSubmitted && (
          <button
            type="button"
            onClick={() => {
              setShowBenefits(true)
              setIsOpen(false)
            }}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#0f172a',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            }}
          >
            Change plan details
          </button>
        )}
        </div>
      )}

      {(selectedPlan || isCashPay) && !isOpen && !directOpen && variant !== 'home' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          padding: '12px 16px', background: 'var(--accent-soft)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius-lg)', fontSize: 14, color: 'var(--text)',
        }}>
          {isCashPay ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <span style={{ flex: 1, fontWeight: 500 }}>No Insurance / Cash Pay</span>
            </>
          ) : (
            <>
              <div style={{
                width: 28, height: 28, borderRadius: 6, background: carrier?.color || '#666',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {(carrier?.name || '?')[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedPlan.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{selectedPlan.type}</div>
              </div>
            </>
          )}
          <button type="button" onMouseDown={handleClearSelection} onClick={handleClearSelection} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--text-3)', fontSize: 18, lineHeight: 1, padding: 0,
          }}>x</button>
          {!isCashPay && selectedPlan && (
            <button
              type="button"
              onClick={() => {
                setShowBenefits(true)
                if (!directOpen) setIsOpen(true)
              }}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                borderRadius: '50%',
                width: 22,
                height: 22,
                cursor: 'pointer',
                color: 'var(--text-2)',
                fontSize: 12,
                lineHeight: 1,
              }}
              aria-label="Configure plan benefits"
            >
              ?
            </button>
          )}
        </div>
      )}

      {!selectedPlan && !isCashPay && !directOpen && variant === 'home' && (
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', width: '100%' }}>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setExpandedCarrierId(null)
              setNestedPlanSearch('')
              setIsOpen(true)
            }}
            style={{
              ...HOME_PILL,
              padding: '11px 14px 11px 14px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(45, 90, 61, 0.12)'
              e.currentTarget.style.borderColor = '#cbd5e1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = HOME_PILL.boxShadow
              e.currentTarget.style.borderColor = '#e2e8f0'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 14, color: '#0f172a' }}>Select insurance plan</span>
              <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>Choose a carrier — adjust plan and amounts in the modal</span>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#2d5a3d',
                marginLeft: 'auto',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(45, 90, 61, 0.35)',
              }}
              aria-hidden
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="10 8 16 12 10 16" />
              </svg>
            </span>
          </button>
        </div>
      )}

      {!selectedPlan && !isCashPay && !directOpen && variant !== 'home' && (
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setExpandedCarrierId(null)
              setNestedPlanSearch('')
              setIsOpen(true)
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', background: 'var(--surface-2)',
              border: `2px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)', cursor: 'pointer',
              fontSize: 15, color: 'var(--text-2)', fontFamily: 'inherit',
              transition: 'border-color 200ms ease, box-shadow 200ms ease',
              boxShadow: isOpen ? '0 0 0 3px var(--accent-soft)' : 'none',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
            <span>Select your insurance</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 'auto' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

        </div>
      )}

      {(isOpen || directOpen) && !isCashPay && (!selectedPlan || directOpen || variant === 'home') && !showBenefits && (
        <div style={pickerPanelStyle}>
          {!directOpen && (
            <div
              style={{
                padding: '14px 16px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.02em' }}>Choose a network</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Tap a carrier — confirm amounts in the next step</div>
              </div>
              <button
                type="button"
                onClick={closeInsurancePicker}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '999px',
                  width: 32,
                  height: 32,
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: 18,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          )}
          <div style={{ padding: '12px 14px 10px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                style={{ position: 'absolute', left: 14, pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search networks…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setExpandedCarrierId(null)
                  setNestedPlanSearch('')
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '12px 14px 12px 42px',
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'inherit',
                  background: '#f8fafc',
                  color: '#0f172a',
                }}
              />
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={handleCashPay}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCashPay() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              margin: '0 10px 6px', padding: '12px 12px',
              cursor: 'pointer', borderRadius: 10,
              background: '#fff',
              border: '1px solid var(--border)',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: '#6b7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 15, fontWeight: 700, flexShrink: 0,
            }}
            >
              $
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>No Insurance / Cash Pay</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>See self-pay and chargemaster rates</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" style={{ flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          <div style={{ padding: '4px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredCarriers.map((c) => {
              const plans = PLANS[c.id] || []
              const planCount = plans.length
              const expanded = expandedCarrierId === c.id
              const nestedFiltered = nestedPlanSearch
                ? plans.filter(p => p.name.toLowerCase().includes(nestedPlanSearch.toLowerCase()))
                : plans
              return (
                <div
                  key={c.id}
                  style={{
                    background: '#fff',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (variant === 'home') {
                        handleSelectCarrier(c.id)
                        setSearchQuery('')
                        return
                      }
                      if (planCount > 1) {
                        setExpandedCarrierId(expanded ? null : c.id)
                        setNestedPlanSearch('')
                        return
                      }
                      handleSelectCarrier(c.id)
                      setSearchQuery('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      if (variant === 'home') {
                        handleSelectCarrier(c.id)
                        setSearchQuery('')
                        return
                      }
                      if (planCount > 1) {
                        setExpandedCarrierId(expanded ? null : c.id)
                        setNestedPlanSearch('')
                      } else {
                        handleSelectCarrier(c.id)
                        setSearchQuery('')
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '12px 12px',
                      cursor: 'pointer', fontSize: 14,
                      color: 'var(--text)',
                      transition: 'background 120ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: c.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 13, fontWeight: 700, marginRight: 12, flexShrink: 0,
                    }}
                    >
                      {c.name.replace(/[^A-Za-z]/g, '').charAt(0) || '?'}
                    </div>
                    <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
                    {planCount > 1 && (
                      <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: variant === 'home' ? 0 : 8 }}>{planCount} plans</span>
                    )}
                    {planCount > 1 && variant !== 'home' && (
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--border)',
                          background: 'var(--surface-2)',
                        }}
                        aria-hidden
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--text-3)"
                          strokeWidth="2.5"
                          style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    )}
                    {(planCount === 1 || variant === 'home') && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={variant === 'home' ? '#2d5a3d' : 'var(--text-3)'} strokeWidth="2.2" style={{ flexShrink: 0, marginLeft: planCount > 1 && variant === 'home' ? 6 : 0 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </div>
                  {expanded && planCount > 1 && variant !== 'home' && (
                    <div style={{
                      borderTop: variant === 'home' ? '1px solid #e2e8f0' : '1px solid var(--surface-2)',
                      background: variant === 'home' ? '#f1f5f9' : 'var(--surface-2)',
                      padding: '10px 10px 12px',
                    }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                        {c.name} · {planCount} plans
                        {nestedPlanSearch.trim() ? (
                          <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 'normal', marginLeft: 6 }}>
                            (showing {nestedFiltered.length} of {planCount})
                          </span>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <input
                          type="text"
                          placeholder="Filter plans in this network…"
                          value={nestedPlanSearch}
                          onChange={(e) => setNestedPlanSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            boxSizing: 'border-box',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            background: 'var(--surface)',
                            padding: '8px 12px',
                            fontSize: 13,
                            color: 'var(--text)',
                            outline: 'none',
                            fontFamily: 'inherit',
                          }}
                        />
                        {nestedPlanSearch.trim() ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setNestedPlanSearch('')
                            }}
                            style={{
                              flexShrink: 0,
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              borderRadius: 10,
                              padding: '8px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              color: 'var(--text-2)',
                            }}
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: variant === 'home' ? 8 : 6, maxHeight: 380, overflowY: 'auto' }}>
                        {nestedFiltered.length === 0 ? (
                          <div style={{ fontSize: 13, color: 'var(--text-3)', padding: 8 }}>No matching plans — clear the filter to see all {planCount}.</div>
                        ) : (
                          nestedFiltered.map((plan) => (
                            <button
                              key={plan.id}
                              type="button"
                              onClick={() => {
                                handleSelectPlan(plan, c.id)
                                setSearchQuery('')
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                cursor: 'pointer',
                                padding: variant === 'home' ? '12px 14px' : '10px 12px',
                                fontFamily: 'inherit',
                                transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                                ...(variant === 'home'
                                  ? {
                                      border: '1px solid #e8e8e8',
                                      background: '#ffffff',
                                      borderRadius: 12,
                                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                                    }
                                  : {
                                      border: '1px solid var(--border)',
                                      background: 'var(--surface)',
                                      borderRadius: 10,
                                    }),
                              }}
                            >
                              <div style={{
                                fontWeight: 600,
                                fontSize: variant === 'home' ? 14 : 13,
                                color: variant === 'home' ? '#0f172a' : 'var(--text)',
                              }}
                              >
                                {plan.name}
                              </div>
                              <div style={{
                                marginTop: 4,
                                fontSize: 12,
                                color: variant === 'home' ? '#64748b' : 'var(--text-3)',
                              }}
                              >
                                ${plan.ded.toLocaleString()} deductible · ${plan.oop.toLocaleString()} OOP max · {plan.coins}% coinsurance
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showBenefits && selectedPlan && (() => {
        const benefitsBody = (
          <>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div id="ac-plan-modal-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                {variant === 'home' ? 'Confirm your plan amounts' : 'Your plan benefits'}
              </div>
              <div style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.45 }}>
                {variant === 'home'
                  ? 'Pre-filled from your selection. Update amounts to match your insurer portal.'
                  : 'Edit values to match your current benefits — deductible remaining updates from what you&apos;ve already paid.'}
              </div>
              {variant === 'home' && (
                <button
                  type="button"
                  onClick={() => {
                    setBenefitsSubmitted(false)
                    userPickedPlanFromListRef.current = false
                    setShowBenefits(false)
                    setShowBenefitsHelp(false)
                    setSearchQuery('')
                    setExpandedCarrierId(null)
                    setNestedPlanSearch('')
                    setIsOpen(true)
                  }}
                  style={{
                    marginTop: 10,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#2d5a3d',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Choose different plan
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowBenefitsHelp((v) => !v)}
                style={{
                  marginTop: 8,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'inherit',
                  display: 'block',
                }}
              >
                Where can I find this?
              </button>
            </div>

            <button
              type="button"
              onClick={closeBenefits}
              style={{
                border: 'none',
                background: variant === 'home' ? '#f1f5f9' : 'var(--surface-2)',
                borderRadius: '999px',
                width: 34,
                height: 34,
                cursor: 'pointer',
                color: 'var(--text-2)',
                fontSize: 18,
                lineHeight: 1,
                flexShrink: 0,
              }}
              aria-label="Close benefits"
            >
              ×
            </button>
          </div>

          {variant === 'home' && selectedCarrier && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Carrier
                </div>
                <select
                  value={selectedCarrier}
                  onChange={(e) => handleHomeCarrierChange(e.target.value)}
                  aria-label="Insurance carrier"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px 36px 11px 14px',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    color: '#0f172a',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                  }}
                >
                  {CARRIERS.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Plan
                </div>
                <select
                  value={selectedPlan?.id ?? ''}
                  onChange={(e) => handleHomePlanChange(e.target.value)}
                  aria-label="Insurance plan"
                  disabled={!selectedCarrier}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px 36px 11px 14px',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    color: '#0f172a',
                    background: '#ffffff',
                    border: '1px solid rgba(45, 90, 61, 0.35)',
                    borderRadius: 12,
                    outline: 'none',
                    cursor: selectedCarrier ? 'pointer' : 'not-allowed',
                    opacity: selectedCarrier ? 1 : 0.65,
                    appearance: 'none',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%232d5a3d\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                  }}
                >
                  {(PLANS[selectedCarrier] || []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {showBenefitsHelp && (
            <div
              style={{
                marginBottom: 12,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                fontSize: 12,
                color: 'var(--text-2)',
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: 'var(--text)' }}>Where to find these values</strong>
              <div style={{ marginTop: 6 }}>
                Deductible and OOP maximum are shown in your insurer portal under plan benefits.
              </div>
              <div>
                Amount already applied to your deductible and remaining OOP are usually in your insurer year-to-date summary.
              </div>
              <div>
                Coinsurance % is listed in your Summary of Benefits and Coverage (SBC) for each service type.
              </div>
              <div>
                If unsure, call the number on your insurance card and ask for your current in-network surgical benefits.
              </div>
            </div>
          )}

          {invalidDeductibleMet && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                background: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid rgba(220, 38, 38, 0.35)',
                fontSize: 12,
                color: 'var(--text)',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: '#b91c1c' }}>Check this amount:</strong>{' '}
              deductible already met (${dedMetNum.toLocaleString()}) cannot exceed your plan deductible (${dedNum.toLocaleString()}) or OOP max (${oopNum.toLocaleString()}).
            </div>
          )}

          {invalidOopRemaining && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                background: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid rgba(220, 38, 38, 0.35)',
                fontSize: 12,
                color: 'var(--text)',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: '#b91c1c' }}>OOP remaining too high:</strong>{' '}
              cannot exceed your plan out-of-pocket maximum (${oopNum.toLocaleString()}).
            </div>
          )}

          {invalidCoins && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                background: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid rgba(220, 38, 38, 0.35)',
                fontSize: 12,
                color: 'var(--text)',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: '#b91c1c' }}>Coinsurance:</strong> enter a whole number from 0 to 100.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { key: 'deductible', label: 'Deductible', value: dedVal, setter: setDedVal, prefix: '$', help: 'The total amount you pay out of pocket for covered care before your plan starts paying its share (coinsurance). Your plan documents list this as the annual deductible.' },
              { key: 'oop_max', label: 'OOP Maximum', value: oopVal, setter: setOopVal, prefix: '$', help: 'The most you pay in a plan year for covered in-network services (deductible, copays, and coinsurance combined). After you hit this cap, covered care is typically paid at 100%.' },
              { key: 'coinsurance', label: 'Coinsurance', value: coinsVal, setter: setCoinsVal, suffix: '%', max: 100, help: 'After you meet the deductible, this is the percentage of allowed charges you still pay. It is usually listed in your Summary of Benefits and Coverage (SBC) as something like “20%” for a given service.' },
              { key: 'deductible_met', label: 'Deductible already met this year', value: dedMetVal, setter: setDedMetVal, prefix: '$', help: 'How much of your annual deductible you have already satisfied this plan year. Use your insurer portal’s year-to-date (YTD) summary, or subtract “deductible remaining” from your full plan deductible if the portal shows remaining only.' },
              { key: 'oop_remaining', label: 'OOP max remaining', value: oopRemainingVal, setter: setOopRemainingVal, prefix: '$', help: 'How much of your annual out-of-pocket maximum you have left before you hit the cap. Your insurer portal often shows this as “out-of-pocket remaining” or similar on your benefits or claims summary.' },
            ].map(field => (
              <div key={field.key} data-benefit-help-root={field.key} style={{ position: 'relative' }}>
                <label style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                  <span>{field.label}</span>
                  <button
                    type="button"
                    aria-expanded={benefitsFieldHelp === field.key}
                    aria-controls={benefitsFieldHelp === field.key ? `benefit-help-${field.key}` : undefined}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setBenefitsFieldHelp(k => (k === field.key ? null : field.key))
                    }}
                    aria-label={`${field.label}: more info`}
                    style={{
                      border: benefitsFieldHelp === field.key ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: benefitsFieldHelp === field.key ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--surface)',
                      color: 'var(--text-2)',
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      fontSize: 10,
                      lineHeight: '14px',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ?
                  </button>
                </label>
                {benefitsFieldHelp === field.key && (
                  <div
                    id={`benefit-help-${field.key}`}
                    role="region"
                    aria-label={`${field.label} explanation`}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '100%',
                      zIndex: 5,
                      marginTop: 4,
                      padding: '10px 12px',
                      borderRadius: variant === 'home' ? 10 : 'var(--radius)',
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: 'var(--text)',
                      background: variant === 'home' ? '#f8fafc' : 'var(--surface-2)',
                      border: variant === 'home' ? '1px solid #e2e8f0' : '1px solid var(--border)',
                      boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
                    }}
                  >
                    {field.help}
                  </div>
                )}
                <div style={{ position: 'relative' }}>
                  {field.prefix && (
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-3)' }}>
                      {field.prefix}
                    </span>
                  )}
                  <input
                    type="number"
                    min="0"
                    max={field.max != null ? field.max : undefined}
                    value={field.value}
                    onChange={(e) => field.setter(e.target.value)}
                    onBlur={
                      field.key === 'coinsurance'
                        ? (e) => {
                            const n = parseInt(e.target.value, 10)
                            if (e.target.value !== '' && !Number.isNaN(n)) {
                              field.setter(String(Math.min(100, Math.max(0, n))))
                            }
                          }
                        : undefined
                    }
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      ...(variant === 'home'
                        ? {
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            color: '#0f172a',
                          }
                        : {
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                          }),
                      borderRadius: variant === 'home' ? 12 : 'var(--radius)',
                      padding: field.prefix ? '10px 14px 10px 24px' : '10px 28px 10px 14px',
                      fontSize: 14, transition: 'border-color 180ms ease',
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  {field.suffix && (
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-3)' }}>
                      {field.suffix}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.5 }}>
            {selectedPlan?.name
              ? `Pre-filled from ${selectedPlan.name} — edit any field to override. Values flow into your cost estimate.`
              : 'Configure your exact plan values and remaining balances here. These values are passed forward and used in OOP calculations.'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button
              type="button"
              onClick={variant === 'home' ? submitBenefitsModal : closeBenefits}
              disabled={benefitsSaveBlocked}
              style={{
                border: 'none',
                background: benefitsSaveBlocked ? 'var(--surface-3)' : 'var(--accent)',
                color: benefitsSaveBlocked ? 'var(--text-3)' : 'var(--accent-text)',
                borderRadius: variant === 'home' ? 12 : 'var(--radius-lg)',
                padding: '12px 22px',
                fontSize: 14,
                fontWeight: 700,
                cursor: benefitsSaveBlocked ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: variant === 'home' && !benefitsSaveBlocked ? '0 2px 8px rgba(45, 90, 61, 0.25)' : 'none',
              }}
            >
              {benefitsSaveBlocked
                ? 'Fix errors to save'
                : variant === 'home'
                  ? 'Submit'
                  : 'Done'}
            </button>
          </div>
          </>
        );
        return (
          <>
            {benefitsUseModalShell && createPortal(
              <>
                <div className="ac-plan-modal-backdrop" onClick={closeBenefits} role="presentation" />
                <div
                  className={variant === 'home' ? 'ac-plan-modal-panel ac-plan-modal-panel--home' : 'ac-plan-modal-panel ac-plan-modal-panel--wide'}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="ac-plan-modal-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  {benefitsBody}
                </div>
              </>,
              document.body
            )}
            {!benefitsUseModalShell && (
              <div style={{
                marginTop: 16, padding: '20px', background: 'var(--surface-2)',
                borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
              }}
              >
                {benefitsBody}
              </div>
            )}
          </>
        );
      })()}
    </div>
  )
}
