import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import Header from '../components/Header'
import PlanSelector from '../components/PlanSelector'
import { getAllProcedures, searchProcedures } from '../data/costEngine'
import { apiUrl } from '../api'

const { categories } = getAllProcedures()

const PROC_DISPLAY = {
  ankle_arthro: 'Ankle Repair - Arthroscopic',
  finger_fracture: 'Articular Finger Fracture Repair - Surgical',
  breast_mri: 'Breast MRI', breast_ultrasound: 'Breast Ultrasound',
  bronchoscopy: 'Bronchoscopy', carpal_tunnel: 'Carpal Tunnel Repair',
  cataract: 'Cataract Removal with Intraocular Lens Insertion',
  clavicle_repair: 'Clavicle/Scapula Repair - Non-Surgical',
  colonoscopy: 'Colonoscopy', colonoscopy_stoma: 'Colonoscopy via Stoma',
  ct: 'CT', ct_abdomen_pelvis: 'CT of Abdomen and Pelvis',
  cesarean: 'Delivery - Cesarean', vaginal_delivery: 'Delivery - Vaginal',
  egd: 'Esophagogastroduodenoscopy, Simple', fetal_mri: 'Fetal MRI',
  fna_biopsy: 'Fine Needle Aspiration Biopsy with Ultrasound Guidance',
  wrist_repair: 'Forearm/Wrist Repair - Non-Surgical',
  hernia_lap: 'Hernia Repair - Laparoscopic', hernia_open: 'Hernia Repair - Non-Laparoscopic',
  hip_arthro: 'Hip Repair - Arthroscopic', hysteroscopy: 'Hysteroscopy with Surgical Procedure',
  knee_arthro: 'Knee Repair - Arthroscopic',
  lap_ovary: 'Laparoscopic Surgery of Ovaries and/or Fallopian Tubes',
  mammogram: 'Mammogram', mri_contrast: 'MRI with Contrast',
  mri_no_contrast: 'MRI without Contrast', breast_biopsy: 'Percutaneous Breast Biopsy',
  shoulder_arthro: 'Shoulder Repair, Complex - Arthroscopic',
  tonsil_child: 'Tonsil and Adenoid Removal (Child Under 12)',
  tonsil: 'Tonsil and/or Adenoid Removal', ultrasound: 'Ultrasound', xray: 'X-Ray',
}

const CATEGORY_ORDER = [
  'Musculoskeletal', 'Radiology & Imaging', 'Gastrointestinal', 'Obstetrics',
  'Reproductive', 'ENT', 'Ophthalmology', 'Pulmonary', 'Neurology', 'Diagnostic',
]

function sameInsurance(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  const aPlan = a.plan || {}
  const bPlan = b.plan || {}
  return (
    (a.plan_id || null) === (b.plan_id || null) &&
    Boolean(a.isCashPay) === Boolean(b.isCashPay) &&
    Number(a.deductible_remaining ?? 0) === Number(b.deductible_remaining ?? 0) &&
    Number(a.oop_max_remaining ?? 0) === Number(b.oop_max_remaining ?? 0) &&
    Number(a.coinsurance_pct ?? 0) === Number(b.coinsurance_pct ?? 0) &&
    Number(a.pc_copay ?? 0) === Number(b.pc_copay ?? 0) &&
    (aPlan.payer || '') === (bPlan.payer || '') &&
    (aPlan.plan_name || '') === (bPlan.plan_name || '') &&
    (aPlan.network_type || '') === (bPlan.network_type || '')
  )
}

export default function HomePage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const routeLocation = useLocation()

  const [selectedProc, setSelectedProc] = useState(null)
  const [procQuery, setProcQuery] = useState('')
  const [procOpen, setProcOpen] = useState(false)
  const [procCategory, setProcCategory] = useState(null)
  const [searchRemoteResults, setSearchRemoteResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const [zipInput, setZipInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [location, setLocation] = useState({ lat: null, lng: null, zip: '', city: '', state: '' })
  const [zipValidation, setZipValidation] = useState({ status: 'idle', message: '', city: '', stateAbbr: '' })
  const [geoLoading, setGeoLoading] = useState(false)
  const [citySuggestions, setCitySuggestions] = useState([])
  const [citySearchLoading, setCitySearchLoading] = useState(false)
  const [locSuggestionHighlight, setLocSuggestionHighlight] = useState(-1)

  const [selectedInsurance, setSelectedInsurance] = useState(null)
  const [insuranceLoaded, setInsuranceLoaded] = useState(false)
  const [isComparing, setIsComparing] = useState(false)
  const [compareError, setCompareError] = useState('')

  const pillRef = useRef(null)
  const locRef = useRef(null)
  const locInputRef = useRef(null)
  const zipRequestId = useRef(0)
  const searchAbortRef = useRef(0)
  /** Skip one debounced city fetch after we programmatically set the input (pick list / GPS). */
  const suppressCitySearchRef = useRef(false)

  // Auto-fill saved insurance from Clerk metadata or localStorage
  const { user } = useUser()
  useEffect(() => {
    if (insuranceLoaded) return
    let saved = null
    try {
      const meta = user?.unsafeMetadata?.insurance
      if (meta) saved = meta
    } catch { /* ignore */ }
    if (!saved) {
      try {
        const raw = localStorage.getItem('anacare:insurance')
        if (raw) saved = JSON.parse(raw)
      } catch { /* ignore */ }
    }
    if (saved && !selectedInsurance) {
      if (saved.isCashPay) {
        setSelectedInsurance({ plan_id: null, plan: null, isCashPay: true, deductible_remaining: 0, oop_max_remaining: 99999, coinsurance_pct: 1.0 })
      } else if (saved.plan_id) {
        const ded = saved.deductible || 0
        const dedMet = saved.deductible_met || 0
        setSelectedInsurance({
          plan_id: saved.plan_id,
          plan: { payer: saved.carrier || 'Insurance', plan_name: saved.plan_name || 'Your plan', network_type: saved.plan_type || 'PPO', deductible: ded, oop_max: saved.oop_max || 0 },
          deductible_remaining: Math.max(0, ded - dedMet),
          oop_max_remaining: saved.oop_max || 0,
          coinsurance_pct: saved.coinsurance_pct ?? 0.20,
          pc_copay: 0,
        })
      }
      setInsuranceLoaded(true)
    }
  }, [user, insuranceLoaded, selectedInsurance])

  useEffect(() => {
    function handleClick(e) {
      if (pillRef.current && !pillRef.current.contains(e.target)) { setProcOpen(false); setHighlightIndex(-1) }
      if (locRef.current && !locRef.current.contains(e.target)) {
        setCitySuggestions([])
        setLocSuggestionHighlight(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!procOpen) return
    const q = procQuery.trim()
    if (q.length < 1) { setSearchRemoteResults([]); setSearchLoading(false); setHighlightIndex(-1); return }
    setSearchLoading(true)
    const runId = ++searchAbortRef.current
    const t = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/v2/procedures/search?q=${encodeURIComponent(q)}&limit=20`))
        if (runId !== searchAbortRef.current) return
        const data = await res.json()
        const rows = Array.isArray(data.results) ? data.results : []
        setSearchRemoteResults(rows)
        setHighlightIndex(rows.length ? 0 : -1)
      } catch {
        if (runId !== searchAbortRef.current) return
        const local = searchProcedures(q)
        setSearchRemoteResults(local.map((p) => ({ id: p.id, name: p.name, cpt_primary: null, episode_key: null })))
        setHighlightIndex(local.length ? 0 : -1)
      } finally {
        if (runId === searchAbortRef.current) setSearchLoading(false)
      }
    }, 220)
    return () => clearTimeout(t)
  }, [procQuery, procOpen])

  const geocodeZip = useCallback(async (raw) => {
    if (raw.length < 5) return
    const id = ++zipRequestId.current
    setZipValidation({ status: 'loading', message: '', city: '', stateAbbr: '' })
    try {
      const res = await fetch('https://api.zippopotam.us/us/' + raw)
      if (id !== zipRequestId.current) return
      if (!res.ok) { setZipValidation({ status: 'invalid', message: 'Invalid ZIP code.', city: '', stateAbbr: '' }); setLocation(prev => ({ ...prev, lat: null, lng: null, city: '', state: '', zip: raw })); return }
      const geo = await res.json()
      const place = geo.places?.[0]
      if (!place) { setZipValidation({ status: 'invalid', message: 'Invalid ZIP code.', city: '', stateAbbr: '' }); setLocation(prev => ({ ...prev, lat: null, lng: null, city: '', state: '', zip: raw })); return }
      const placeName = place['place name'] ?? ''
      const stateAbbr = place['state abbreviation'] ?? ''
      setLocation({ lat: parseFloat(place.latitude), lng: parseFloat(place.longitude), zip: raw, city: placeName, state: stateAbbr })
      setZipValidation({ status: 'valid', message: '', city: placeName, stateAbbr: stateAbbr ? String(stateAbbr).trim().toUpperCase() : '' })
    } catch {
      setZipValidation({ status: 'invalid', message: 'Could not verify ZIP code.', city: '', stateAbbr: '' })
      setLocation(prev => ({ ...prev, lat: null, lng: null, city: '', state: '', zip: raw }))
    }
  }, [])

  const fillNearestZip = useCallback(async (lat, lng, fallbackCity = '', fallbackStateAbbr = '') => {
    try {
      const res = await fetch(apiUrl(`/zipcodes/nearest?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`))
      if (!res.ok) throw new Error('nearest')
      const j = await res.json()
      const zip = String(j.zip ?? '').replace(/\D/g, '').slice(0, 5)
      if (zip.length !== 5) throw new Error('nozip')
      setLocation((prev) => ({
        ...prev,
        zip,
        city: j.city || prev.city || fallbackCity,
        state: (j.state || prev.state || fallbackStateAbbr || '').toString().toUpperCase().slice(0, 2),
      }))
      setZipInput(zip)
      setZipValidation({
        status: 'valid',
        message: '',
        city: j.city || fallbackCity,
        stateAbbr: (j.state || fallbackStateAbbr || '').toString().toUpperCase().slice(0, 2),
      })
    } catch {
      setZipInput('')
      setZipValidation({
        status: 'valid',
        message: '',
        city: fallbackCity,
        stateAbbr: fallbackStateAbbr,
      })
    }
  }, [])

  const selectCitySuggestion = useCallback(
    async (s) => {
      suppressCitySearchRef.current = true
      setLocationInput(s.label)
      setCitySuggestions([])
      setLocSuggestionHighlight(-1)
      const zipOk = s.zip && String(s.zip).length === 5
      setLocation({
        lat: s.lat,
        lng: s.lng,
        zip: zipOk ? s.zip : '',
        city: s.city || '',
        state: s.state || '',
      })
      if (zipOk) {
        setZipInput(s.zip)
        setZipValidation({
          status: 'valid',
          message: '',
          city: s.city || '',
          stateAbbr: s.state && s.state.length === 2 ? s.state.toUpperCase() : '',
        })
      } else {
        setZipInput('')
        setZipValidation({ status: 'loading', message: '', city: s.city || '', stateAbbr: '' })
        await fillNearestZip(s.lat, s.lng, s.city || '', s.state && s.state.length === 2 ? s.state.toUpperCase() : '')
      }
    },
    [fillNearestZip],
  )

  useEffect(() => {
    if (suppressCitySearchRef.current) {
      suppressCitySearchRef.current = false
      setCitySuggestions([])
      setCitySearchLoading(false)
      return
    }
    const trimmed = locationInput.trim()
    if (/^\d{0,5}$/.test(trimmed) || trimmed.length < 2) {
      setCitySuggestions([])
      setCitySearchLoading(false)
      return
    }
    let cancelled = false
    setCitySearchLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/v2/places/search?q=${encodeURIComponent(trimmed)}&limit=8`))
        if (cancelled) return
        if (!res.ok) throw new Error('places')
        const data = await res.json()
        const rows = Array.isArray(data.results) ? data.results : []
        if (cancelled) return
        setCitySuggestions(rows)
        setLocSuggestionHighlight(rows.length ? 0 : -1)
      } catch {
        if (!cancelled) {
          setCitySuggestions([])
          setLocSuggestionHighlight(-1)
        }
      } finally {
        if (!cancelled) setCitySearchLoading(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [locationInput])

  const useCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    setCitySuggestions([])
    setLocSuggestionHighlight(-1)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try {
          const res = await fetch(apiUrl(`/zipcodes/nearest?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`))
          if (!res.ok) throw new Error('nearest_zip')
          const j = await res.json()
          const zip = String(j.zip ?? '').replace(/\D/g, '').slice(0, 5)
          if (zip.length === 5) {
            setZipInput(zip)
            suppressCitySearchRef.current = true
            setLocationInput(
              [j.city, j.state].filter(Boolean).length
                ? `${[j.city, j.state].filter(Boolean).join(', ')} · ${zip}`
                : zip,
            )
            setLocation({ lat: typeof j.lat === 'number' ? j.lat : lat, lng: typeof j.lng === 'number' ? j.lng : lng, zip, city: j.city || '', state: (j.state || '').toUpperCase() })
            setZipValidation({ status: 'valid', message: '', city: j.city || '', stateAbbr: (j.state || '').toUpperCase().slice(0, 2) })
          } else {
            setZipInput('')
            suppressCitySearchRef.current = true
            setLocationInput('Current location')
            setLocation({ lat, lng, zip: '', city: '', state: '' })
            setZipValidation({ status: 'idle', message: '', city: '', stateAbbr: '' })
          }
        } catch {
          setZipInput('')
          suppressCitySearchRef.current = true
          setLocationInput('Current location')
          setLocation({ lat, lng, zip: '', city: '', state: '' })
          setZipValidation({ status: 'idle', message: '', city: '', stateAbbr: '' })
        } finally {
          setGeoLoading(false)
        }
      },
      () => {
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    )
  }, [])

  function handleLocationInputChange(e) {
    const raw = e.target.value
    setLocSuggestionHighlight(-1)
    const noSpaces = raw.replace(/\s/g, '')
    if (noSpaces === '' || (/^\d+$/.test(noSpaces) && noSpaces.length <= 5)) {
      const z = noSpaces.slice(0, 5)
      setLocationInput(z)
      setZipInput(z)
      setCitySuggestions([])
      if (z.length < 5) {
        setZipValidation({ status: 'idle', message: '', city: '', stateAbbr: '' })
        setLocation((prev) => ({ ...prev, lat: null, lng: null, city: '', state: '', zip: z }))
      } else {
        setZipValidation({ status: 'loading', message: '', city: '', stateAbbr: '' })
        setLocation((prev) => ({ ...prev, lat: null, lng: null, city: '', state: '', zip: z }))
        geocodeZip(z)
      }
      return
    }
    setLocationInput(raw)
    setZipInput('')
    setLocation({ lat: null, lng: null, zip: '', city: '', state: '' })
    setZipValidation({ status: 'idle', message: '', city: '', stateAbbr: '' })
  }

  function onLocationKeyDown(e) {
    if (citySuggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setLocSuggestionHighlight((i) => Math.min(i + 1, citySuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setLocSuggestionHighlight((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && locSuggestionHighlight >= 0) {
      e.preventDefault()
      const s = citySuggestions[locSuggestionHighlight]
      if (s) void selectCitySuggestion(s)
    } else if (e.key === 'Escape') {
      setCitySuggestions([])
      setLocSuggestionHighlight(-1)
    }
  }

  const selectProc = (id, displayName) => {
    setSelectedProc(id); setProcQuery(displayName || PROC_DISPLAY[id] || id)
    setProcOpen(false); setProcCategory(null); setSearchRemoteResults([]); setHighlightIndex(-1)
  }

  const isFindDisabled = !selectedProc || (!location.lat && zipInput.length !== 5)

  async function handleCompare() {
    if (!selectedProc || isComparing) return
    setIsComparing(true); setCompareError('')
    try {
      const nextLat = location.lat, nextLng = location.lng, nextZip = location.zip || zipInput
      if ((nextLat == null || nextLng == null) && (!nextZip || nextZip.length !== 5)) {
        setCompareError('Enter a valid ZIP or city, or use your location.')
        return
      }
      const nextState = {
        procedures: [{ name: PROC_DISPLAY[selectedProc] || selectedProc, id: selectedProc }],
        location: { lat: nextLat, lng: nextLng, zip: nextZip, radius_miles: 25 },
        plan: {
          plan_id: selectedInsurance?.plan_id || null, plan: selectedInsurance?.plan || null,
          deductible_remaining: selectedInsurance?.deductible_remaining ?? null,
          oop_max_remaining: selectedInsurance?.oop_max_remaining ?? null,
          coinsurance_pct: selectedInsurance?.coinsurance_pct ?? 0.20,
          pc_copay: selectedInsurance?.pc_copay ?? 0, isCashPay: selectedInsurance?.isCashPay ?? false,
        },
      }
      sessionStorage.setItem('anacare:lastSearchState', JSON.stringify(nextState))
      navigate('/results', { state: nextState })
    } catch { setCompareError('Unable to load results yet. Please confirm your location and try again.') }
    finally { setIsComparing(false) }
  }

  function onProcInputChange(e) { setProcQuery(e.target.value); setProcOpen(true); setProcCategory(null); if (selectedProc) setSelectedProc(null) }
  function onProcInputFocus() { setProcOpen(true) }

  function onProcKeyDown(e) {
    if (!procOpen) return
    const list = procQuery.trim().length > 0 ? searchRemoteResults : []
    if (list.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex((i) => Math.min(i + 1, list.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && highlightIndex >= 0 && list[highlightIndex]) { e.preventDefault(); selectProc(list[highlightIndex].id, list[highlightIndex].name) }
    else if (e.key === 'Escape') { setProcOpen(false); setHighlightIndex(-1) }
  }

  useEffect(() => {
    const prefill = routeLocation.state?.prefill
    if (!prefill) return
    const prefillProc = prefill.procedures?.[0]
    if (prefillProc?.id) { setSelectedProc(prefillProc.id); setProcQuery(prefillProc.name || PROC_DISPLAY[prefillProc.id] || prefillProc.id) }
    if (prefill.location?.zip) {
      setZipInput(prefill.location.zip)
      setLocationInput(prefill.location.zip)
      setLocation((prev) => ({ ...prev, lat: prefill.location.lat ?? null, lng: prefill.location.lng ?? null, zip: prefill.location.zip ?? '' }))
      if (prefill.location.zip.length === 5) geocodeZip(prefill.location.zip)
    }
    if (prefill.plan) setSelectedInsurance(prefill.plan)
  }, [routeLocation.state, geocodeZip])

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes hp-fade-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .hp-page {
          min-height: 100vh; min-height: 100dvh;
          background: linear-gradient(165deg, #f8faf9 0%, #f1f4f2 38%, #e8ece9 100%);
          display: flex; flex-direction: column;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .hp-hero { padding: 72px 24px 32px; text-align: center; animation: hp-fade-in 0.55s cubic-bezier(0.16,1,0.3,1); }
        .hp-hero h1 {
          font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
          font-size: clamp(1.85rem, 4.2vw, 2.65rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #2d5a3d;
          margin: 0 0 14px;
          line-height: 1.15;
        }
        .hp-hero p { font-size: 16px; color: #6b6b6b; margin: 0 auto; line-height: 1.55; max-width: 480px; font-weight: 400; }
        .hp-box-wrap { max-width: 560px; margin: 0 auto; padding: 0 22px 36px; animation: hp-fade-in 0.6s cubic-bezier(0.16,1,0.3,1) 0.08s both; }
        .hp-box {
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 18px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 16px 40px -12px rgba(15, 23, 42, 0.1);
          overflow: visible;
        }
        .hp-sec { padding: 22px 24px; position: relative; }
        .hp-sec:not(:last-child) { border-bottom: 1px solid #e8e8e8; }
        .hp-lbl {
          display: flex; align-items: center; gap: 8px;
          font-size: 11px; font-weight: 600; color: #9ca3af;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .hp-lbl svg { flex-shrink: 0; opacity: 0.85; }
        .hp-inp {
          width: 100%; padding: 14px 16px;
          background: var(--surface-2, #f1f3f5);
          border: 1.5px solid var(--border, #dee2e6);
          border-radius: 12px;
          font-size: 15px;
          font-family: inherit;
          color: var(--text, #1c2a22);
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .hp-inp:focus { border-color: #2d5a3d; box-shadow: 0 0 0 3px rgba(45, 90, 61, 0.14); }
        .hp-inp::placeholder { color: var(--text-3, #6b5e4f); }
        .hp-inp--zip { max-width: 220px; flex: 1 1 180px; }
        .hp-loc-row { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
        .hp-loc-actions { display: flex; align-items: center; flex: 1; min-height: 48px; }
        .hp-loc-wrap {
          position: relative;
          flex: 1 1 200px;
          min-width: 160px;
        }
        .hp-field-light {
          width: 100%;
          box-sizing: border-box;
          padding: 14px 16px;
          background: #fafcfb;
          border: 1.5px solid #e2e8e4;
          border-radius: 12px;
          font-size: 15px;
          font-family: inherit;
          color: #1c2a22;
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .hp-field-light:focus {
          border-color: #2d5a3d;
          box-shadow: 0 0 0 3px rgba(45, 90, 61, 0.12);
        }
        .hp-field-light::placeholder { color: #8a938e; }
        .hp-loc-sug {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(100% + 6px);
          z-index: 60;
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          box-shadow: 0 14px 40px rgba(0,0,0,0.12);
          max-height: 260px;
          overflow-y: auto;
        }
        .hp-loc-si {
          display: block;
          width: 100%;
          text-align: left;
          padding: 10px 14px;
          cursor: pointer;
          font-size: 14px;
          color: #1a1a1a;
          border: none;
          border-bottom: 1px solid #f0f0f0;
          background: #fff;
          font-family: inherit;
        }
        .hp-loc-si:last-child { border-bottom: none; }
        .hp-loc-si:hover, .hp-loc-si[aria-selected="true"] { background: #f3f6f4; }
        .hp-loc-geo-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          background: #ffffff;
          border: 1.5px solid #2d5a3d;
          border-radius: 12px;
          color: #2d5a3d;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s ease, border-color 0.15s ease;
          flex-shrink: 0;
          align-self: flex-start;
        }
        .hp-loc-geo-primary:hover:not(:disabled) {
          background: rgba(45, 90, 61, 0.06);
        }
        .hp-loc-geo-primary:disabled { opacity: 0.5; cursor: wait; }
        .hp-gb {
          border: none;
          background: transparent;
          cursor: pointer;
          color: #a8a8a8;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 4px;
          white-space: nowrap;
          transition: color 0.15s ease;
        }
        .hp-gb:hover { color: #2d5a3d; }
        .hp-gb:disabled { opacity: 0.45; cursor: wait; }
        .hp-loc-valid { margin-top: 10px; display: flex; align-items: center; gap: 6px; font-size: 13px; color: #2d5a3d; font-weight: 500; width: 100%; }
        .hp-loc-invalid { margin-top: 10px; display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--red); width: 100%; }
        .hp-loc-loading { margin-top: 10px; display: flex; align-items: center; gap: 6px; font-size: 13px; color: #888; width: 100%; }
        .hp-insurance-stack { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; }
        .hp-insurance-slot { width: 100%; display: flex; justify-content: center; position: relative; overflow: visible; }
        .hp-sug {
          position: relative;
          margin-top: 10px;
          width: 100%;
          box-sizing: border-box;
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 14px;
          box-shadow: 0 14px 40px rgba(0,0,0,0.12);
          max-height: min(360px, 50vh);
          overflow-y: auto;
        }
        .hp-si { display: flex; align-items: center; padding: 12px 18px; cursor: pointer; font-size: 14px; color: #1a1a1a; border-bottom: 1px solid #f0f0f0; transition: background 100ms ease; }
        .hp-si:hover { background: #f5f5f5; }
        .hp-si:last-child { border-bottom: none; }
        .hp-cpt { font-size: 11px; font-weight: 700; color: #888; letter-spacing: 0.04em; }
        .hp-ch { padding: 12px 18px 6px; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
        .hp-bb { display: flex; align-items: center; padding: 10px 18px; cursor: pointer; font-size: 13px; color: #2d5a3d; font-weight: 600; border-bottom: 1px solid #f0f0f0; background: none; border-top: none; border-left: none; border-right: none; width: 100%; font-family: inherit; }
        .hp-bb:hover { background: #f5f5f5; }
        .hp-cta-ghost {
          width: 100%; padding: 16px 22px;
          border-radius: 12px;
          border: 1.5px solid #2d5a3d;
          background: transparent;
          color: #2d5a3d;
          font-size: 16px; font-weight: 600; font-family: inherit;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
        }
        .hp-cta-ghost:hover:not(:disabled) { background: rgba(45, 90, 61, 0.06); }
        .hp-cta-ghost:disabled { border-color: #d8d8d8; color: #c4c4c4; cursor: not-allowed; }
        .hp-scroll-hint {
          display: flex; justify-content: center;
          padding: 8px 0 28px;
        }
        .hp-scroll-hint button {
          width: 44px; height: 44px; border-radius: 50%;
          border: 1px solid #d8dcd8;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #555;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hp-scroll-hint button:hover { transform: translateY(2px); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        @media (max-width: 640px) {
          .hp-hero { padding: 56px 16px 24px; }
          .hp-box-wrap { padding: 0 14px 28px; }
          .hp-sec { padding: 18px 16px; }
          .hp-inp--zip { max-width: none; }
        }
      `}</style>

      <div className="hp-page">
        <Header planName={selectedInsurance?.isCashPay ? null : (selectedInsurance?.plan?.plan_name || selectedInsurance?.plan?.payer || null)} theme={theme} onToggleTheme={onToggleTheme} />

        <div className="hp-hero">
          <h1>Find your procedure options.</h1>
          <p>We&apos;ll locate hospitals near you and estimate your full out-of-pocket cost.</p>
        </div>

        <div className="hp-box-wrap">
          <div className="hp-box">
            {/* Procedure */}
            <div ref={pillRef} className="hp-sec">
              <div className="hp-lbl">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                Procedure or service
              </div>
              <input type="text" className="hp-inp" placeholder="Search by name or CPT code..." value={procQuery} onChange={onProcInputChange} onFocus={onProcInputFocus} onKeyDown={onProcKeyDown} autoComplete="off" aria-label="Search services" aria-expanded={procOpen} />
              {procOpen && (
                <div className="hp-sug" role="listbox" onMouseDown={(e) => e.preventDefault()}>
                  {procCategory ? (
                    <>
                      <button type="button" className="hp-bb" onClick={() => setProcCategory(null)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><polyline points="15 18 9 12 15 6" /></svg>
                        Back to categories
                      </button>
                      {(categories[procCategory] || []).map((id) => (
                        <div key={id} className="hp-si" role="option" onClick={() => selectProc(id, PROC_DISPLAY[id])}>{PROC_DISPLAY[id] || id}</div>
                      ))}
                    </>
                  ) : procQuery.trim().length > 0 ? (
                    searchLoading ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>Searching...</div>
                    ) : searchRemoteResults.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>No matches found. Try another name or CPT code.</div>
                    ) : (
                      searchRemoteResults.map((p, i) => (
                        <div key={p.id} role="option" className="hp-si" aria-selected={highlightIndex === i} style={{ background: highlightIndex === i ? 'var(--surface-2)' : undefined }} onMouseEnter={() => setHighlightIndex(i)} onClick={() => selectProc(p.id, p.name)}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontWeight: 600 }}>{p.name}</span>
                            {p.cpt_primary && <span className="hp-cpt">CPT {p.cpt_primary}</span>}
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    <>
                      <div style={{ padding: '14px 18px 8px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>Type a service name or CPT code, or browse by category.</div>
                      <div className="hp-ch">Browse by category</div>
                      {CATEGORY_ORDER.map((cat) => (
                        <div key={cat} className="hp-si" onClick={() => setProcCategory(cat)} style={{ justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 500 }}>{cat}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{(categories[cat] || []).length}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Location */}
            <div ref={locRef} className="hp-sec">
              <div className="hp-lbl">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Location
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px', lineHeight: 1.45 }}>
                Enter a ZIP code, search for a city, or use your device location.
              </p>
              <div className="hp-loc-row">
                <div className="hp-loc-wrap">
                  <input
                    ref={locInputRef}
                    type="text"
                    className="hp-field-light"
                    placeholder="ZIP code or city (e.g. Chicago)"
                    value={locationInput}
                    onChange={handleLocationInputChange}
                    onKeyDown={onLocationKeyDown}
                    autoComplete="off"
                    aria-label="ZIP code or city"
                    aria-autocomplete="list"
                    aria-expanded={citySuggestions.length > 0}
                    aria-controls="hp-loc-sug-list"
                  />
                  {citySuggestions.length > 0 && (
                    <div id="hp-loc-sug-list" className="hp-loc-sug" role="listbox" aria-label="City suggestions">
                      {citySuggestions.map((s, i) => (
                        <button
                          key={`${s.lat},${s.lng},${s.label}`}
                          type="button"
                          role="option"
                          className="hp-loc-si"
                          aria-selected={locSuggestionHighlight === i}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setLocSuggestionHighlight(i)}
                          onClick={() => void selectCitySuggestion(s)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" className="hp-loc-geo-primary" disabled={geoLoading} onClick={useCurrentLocation}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg>
                  {geoLoading ? 'Getting location…' : 'Use my location'}
                </button>
              </div>
              {citySearchLoading && citySuggestions.length === 0 && !/^\d{0,5}$/.test(locationInput.trim()) && locationInput.trim().length >= 2 && (
                <div className="hp-loc-loading" style={{ marginTop: 8 }}>
                  <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid #888', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  <span>Searching places…</span>
                </div>
              )}
              {zipValidation.status === 'loading' && (
                <div className="hp-loc-loading" style={{ marginTop: 8 }}>
                  <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid #888', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  <span>{location.lat != null ? 'Finding nearest ZIP…' : 'Validating ZIP…'}</span>
                </div>
              )}
              {location.lat != null && location.lng != null && zipValidation.status === 'valid' && (
                <div className="hp-loc-valid">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="7 13 11 17 17 7" /></svg>
                  <span>
                    {[location.city, location.state].filter(Boolean).join(', ')}
                    {location.zip ? ` · ${location.zip}` : ''}
                  </span>
                </div>
              )}
              {zipInput.length === 5 && zipValidation.status === 'invalid' && (
                <div className="hp-loc-invalid">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="7" x2="12" y2="13" /><circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" /></svg>
                  <span>{zipValidation.message || 'Invalid ZIP code.'}</span>
                </div>
              )}
            </div>

            {/* Insurance — centered pill; benefits + plan picker only from PlanSelector */}
            <div className="hp-sec" onClick={() => { setProcOpen(false); setHighlightIndex(-1) }}>
              <div className="hp-insurance-stack">
                <div className="hp-lbl" style={{ marginBottom: 0, justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Insurance plan
                </div>
                <div className="hp-insurance-slot">
                  <PlanSelector
                    variant="home"
                    initialSelection={selectedInsurance}
                    onChange={(next) => { setSelectedInsurance((prev) => (sameInsurance(prev, next) ? prev : next)) }}
                  />
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="hp-sec" style={{ borderBottom: 'none' }}>
              <button type="button" className="hp-cta-ghost" disabled={isFindDisabled || isComparing} onClick={handleCompare}>
                {isComparing ? 'Finding options…' : 'Compare prices'}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
              {compareError && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13, fontWeight: 500, textAlign: 'center' }}>{compareError}</div>}
            </div>
          </div>
        </div>

        <div className="hp-scroll-hint">
          <button type="button" aria-label="Scroll to more content" onClick={() => window.scrollTo({ top: window.innerHeight * 0.85, behavior: 'smooth' })}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </div>

        {/* Feedback */}
        <div style={{ maxWidth: 680, margin: '20px auto 0', padding: '0 20px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 24, textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Help us improve AnaCare</h3>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.5 }}>Tell us what's working, what's not, and what you'd like to see next.</p>
            <button type="button" onClick={() => navigate('/feedback')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 150ms ease' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}>
              Share feedback
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        <footer style={{ marginTop: 40, borderTop: '1px solid var(--border)', padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
          Estimates are for informational purposes only. Always verify pricing directly with your provider.
        </footer>
      </div>
    </>
  )
}
