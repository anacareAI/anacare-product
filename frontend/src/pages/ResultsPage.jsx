import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import PlanSelector from '../components/PlanSelector'
import ResultsMap from '../components/ResultsMap'
import { searchProcedures, getAllProcedures } from '../data/costEngine'
import { apiUrl } from '../api'

const SORT_TABS = [
  { label: 'Lowest Price', value: 'lowest_cost' },
  { label: 'Best Quality', value: 'top_rated' },
  { label: 'Best Value', value: 'best_value' },
]

const RADIUS_STEPS = [5, 10, 25, 50, 75, 100, 150, 200, 250]

/** Post-filter distances (subset of hospitals returned for the current search radius). */
const DISTANCE_FILTER_PRESETS = [
  { value: 10, label: 'Within 10 miles' },
  { value: 25, label: 'Within 25 miles' },
  { value: 50, label: 'Within 50 miles' },
  { value: 75, label: 'Within 75 miles' },
  { value: 100, label: 'Within 100 miles' },
  { value: 150, label: 'Within 150 miles' },
  { value: 200, label: 'Within 200 miles' },
  { value: 250, label: 'Within 250 miles' },
  { value: null, label: 'All distances' },
]
const QUALITY_OPTIONS = [
  { label: '2+', value: 2 },
  { label: '3+', value: 3 },
  { label: '4+', value: 4 },
  { label: '5', value: 5 },
]
const NEGOTIATED_LABEL = 'Negotiated Rate'
const OOP_LABEL = 'Estimated Out-of-Pocket'

const { categories: PROC_CATEGORIES } = getAllProcedures()
const CATEGORY_ORDER = [
  'Musculoskeletal', 'Radiology & Imaging', 'Gastrointestinal', 'Obstetrics',
  'Reproductive', 'ENT', 'Ophthalmology', 'Pulmonary', 'Neurology', 'Diagnostic',
]
const ALL_PROCEDURES = Object.values(getAllProcedures().procedures)
  .sort((a, b) => a.name.localeCompare(b.name))

const PROCEDURE_DESCRIPTIONS = {
  ankle_arthro: 'Ankle arthroscopy is a minimally invasive procedure used to diagnose and treat problems inside the ankle joint, such as cartilage injury, scar tissue, or bone impingement. A camera and small instruments are inserted through tiny incisions around the ankle to restore joint function and reduce pain.',
  finger_fracture: 'Articular finger fracture repair is performed when a fracture extends into a finger joint and needs precise alignment to preserve motion. Treatment may include fixation with pins, screws, or plates to stabilize the bone while it heals and reduce long-term stiffness or arthritis risk.',
  breast_mri: 'Breast MRI uses strong magnets and radio waves to create detailed images of breast tissue, often for high-risk screening or further evaluation of abnormalities seen on mammography or ultrasound. It may be performed with contrast to improve detection of lesions and vascular patterns.',
  breast_ultrasound: 'Breast ultrasound uses sound waves to evaluate specific areas of concern, such as a lump or focal pain, and to distinguish cystic from solid findings. It is commonly used as a diagnostic follow-up test and as guidance for certain biopsy procedures.',
  bronchoscopy: 'Bronchoscopy allows a clinician to examine the airways using a flexible scope passed through the nose or mouth into the lungs. It can be used to diagnose infection, inflammation, bleeding, or masses, and may include tissue sampling during the same procedure.',
  carpal_tunnel: 'Carpal tunnel repair relieves pressure on the median nerve at the wrist by releasing the transverse carpal ligament. The procedure is intended to improve numbness, tingling, pain, and hand weakness caused by carpal tunnel syndrome.',
  cataract: 'Cataract surgery removes the clouded natural lens of the eye and replaces it with an artificial intraocular lens to restore visual clarity. It is typically performed as an outpatient procedure and is one of the most common surgeries in ophthalmology.',
  clavicle_repair: 'Non-surgical clavicle or scapular fracture management typically includes immobilization, pain control, and follow-up imaging to monitor healing. Physical therapy is often added later to restore shoulder strength, range of motion, and function.',
  colonoscopy: 'Colonoscopy examines the inner lining of the colon and rectum with a flexible camera-based scope to detect polyps, inflammation, bleeding, or cancer. Polyps can often be removed during the same procedure, making colonoscopy both diagnostic and preventive.',
  colonoscopy_stoma: 'Colonoscopy via stoma evaluates the large bowel through an ostomy opening rather than through the rectum. It is used for patients with prior bowel surgery and can identify bleeding, inflammation, strictures, or polyps in the remaining colon.',
  ct: 'A CT scan combines multiple X-ray images with computer processing to generate detailed cross-sectional views of internal anatomy. It is used in many clinical settings to evaluate trauma, infection, tumors, vascular disease, and other urgent or complex conditions.',
  ct_abdomen_pelvis: 'CT of the abdomen and pelvis provides detailed imaging of organs such as the liver, kidneys, intestines, bladder, and reproductive structures. It is commonly ordered for abdominal pain, suspected infection, kidney stones, appendicitis, bowel disease, or masses.',
  cesarean: 'Cesarean delivery is a surgical birth performed through incisions in the abdomen and uterus when vaginal delivery is unsafe or not feasible. This bundle often includes hospital facility, obstetric, anesthesia, and immediate postpartum care components.',
  vaginal_delivery: 'Vaginal delivery is childbirth through the birth canal and may be spontaneous or assisted depending on labor progress. Typical episode-based care includes labor management, delivery services, and immediate postpartum maternal monitoring.',
  egd: 'Esophagogastroduodenoscopy (EGD) uses a flexible scope to visualize the esophagus, stomach, and first part of the small intestine. It is used to investigate symptoms such as reflux, pain, bleeding, anemia, or swallowing difficulty and may include biopsy.',
  fetal_mri: 'Fetal MRI provides advanced imaging of a fetus during pregnancy, most often to clarify findings seen on prenatal ultrasound. It helps evaluate brain, spine, chest, and abdominal anatomy when higher soft-tissue detail is needed for diagnosis and care planning.',
  fna_biopsy: 'Fine needle aspiration biopsy with ultrasound guidance uses a thin needle to sample cells from a suspicious lesion for pathology review. Real-time imaging improves targeting accuracy and helps minimize unnecessary tissue trauma.',
  wrist_repair: 'Non-surgical forearm or wrist fracture treatment typically uses casting or splinting to maintain alignment while bone healing occurs. Follow-up imaging and rehabilitation are used to confirm recovery and improve strength and mobility.',
  hernia_lap: 'Laparoscopic hernia repair uses small incisions, a camera, and instruments to reduce herniated tissue and reinforce the defect, often with mesh. Compared with open repair, it may offer less postoperative pain and quicker return to activity in selected patients.',
  hernia_open: 'Open hernia repair treats a hernia through a direct incision over the affected area, with closure of the defect and possible mesh reinforcement. It is commonly used for larger, complex, or recurrent hernias and remains a standard surgical approach.',
  hip_arthro: 'Hip arthroscopy is a minimally invasive procedure to diagnose and treat intra-articular hip pathology such as labral tears, impingement, or loose bodies. Small portals allow the surgeon to repair tissue and improve joint mechanics while preserving native structures.',
  hysteroscopy: 'Hysteroscopy with surgical intervention uses a thin scope through the cervix to inspect the uterine cavity and treat abnormalities such as polyps, fibroids, adhesions, or retained tissue. It can both diagnose and correct uterine conditions in a single session.',
  knee_arthro: 'Knee arthroscopy evaluates and treats internal knee problems through small incisions using a camera and specialized instruments. Common indications include meniscal tears, cartilage injury, loose fragments, and inflammatory joint conditions.',
  lap_ovary: 'Laparoscopic surgery of the ovaries and/or fallopian tubes is used for conditions such as ovarian cysts, endometriosis, ectopic pregnancy, adnexal masses, or sterilization. The minimally invasive approach often shortens recovery compared with open abdominal surgery.',
  mammogram: 'Mammography uses low-dose X-rays to screen for and diagnose breast cancer, including lesions that may not be palpable on exam. It remains a core breast screening tool and is often combined with targeted diagnostic imaging when abnormalities are detected.',
  mri_contrast: 'MRI with contrast uses intravenous gadolinium to enhance tissue characterization and vascular detail on magnetic resonance images. It is especially useful when evaluating tumors, inflammation, postoperative change, or subtle neurologic and musculoskeletal findings.',
  mri_no_contrast: 'MRI without contrast creates high-detail images of soft tissues, joints, spine, brain, and organs using magnetic fields and radiofrequency signals. It is often the first-line advanced imaging option when contrast is not required.',
  breast_biopsy: 'Percutaneous breast biopsy obtains tissue from a suspicious breast lesion using a needle under imaging guidance, often ultrasound, stereotactic mammography, or MRI. The sample is analyzed by pathology to determine whether findings are benign, high-risk, or malignant.',
  shoulder_arthro: 'Complex shoulder arthroscopy treats conditions such as rotator cuff tears, labral injury, instability, or impingement using minimally invasive techniques. The procedure may combine debridement, repair, and decompression depending on the pathology identified.',
  tonsil_child: 'Tonsil and adenoid removal in children under 12 is performed for recurrent infection, obstructive sleep-disordered breathing, or airway-related symptoms. The procedure is typically outpatient but includes postoperative monitoring for hydration, pain control, and bleeding risk.',
  tonsil: 'Tonsillectomy, with or without adenoidectomy, removes chronically inflamed or enlarged lymphoid tissue in the throat to reduce infections or improve breathing. It is commonly considered for recurrent tonsillitis, obstructive symptoms, or sleep apnea-related concerns.',
  ultrasound: 'Diagnostic ultrasound uses high-frequency sound waves to generate real-time images of soft tissues and blood flow without ionizing radiation. It is widely used across abdominal, pelvic, vascular, musculoskeletal, thyroid, and obstetric evaluations.',
  xray: 'X-ray imaging uses a small amount of ionizing radiation to visualize bones, lungs, and other structures quickly and cost-effectively. It is often the first diagnostic test for fractures, chest symptoms, and many acute care presentations.',
}

function radiusStepIndex(miles) {
  let closest = 0
  for (let i = 0; i < RADIUS_STEPS.length; i++) {
    if (Math.abs(RADIUS_STEPS[i] - miles) < Math.abs(RADIUS_STEPS[closest] - miles)) closest = i
  }
  return closest
}

function RadiusSlider({ value, onChange, id, showBandQuickPicks = false }) {
  const idx = radiusStepIndex(value)
  const fillPct = (idx / (RADIUS_STEPS.length - 1)) * 100
  const chipBase = {
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          Search radius: {value >= 250 ? '250+' : value} mi
        </span>
      </div>
      <div className="radius-slider-container">
        <div className="radius-slider-fill" style={{ width: `${fillPct}%` }} />
        <input
          id={id}
          type="range"
          className="radius-slider"
          min={0}
          max={RADIUS_STEPS.length - 1}
          step={1}
          value={idx}
          onChange={(e) => onChange(RADIUS_STEPS[Number(e.target.value)])}
          aria-label="Search radius in miles"
          style={{ position: 'relative', zIndex: 1, background: 'transparent' }}
        />
      </div>
      <div className="radius-slider-ticks">
        {RADIUS_STEPS.map((s, i) => (
          <span key={i} className="radius-slider-tick" style={{
            fontWeight: s === value ? 700 : 400,
            color: s === value ? 'var(--accent)' : 'var(--text-3)',
          }}>
            {s === 250 ? '250+' : s}
          </span>
        ))}
      </div>
      {showBandQuickPicks && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {[
            { label: '≤50 mi', miles: 50 },
            { label: '51–250 mi', miles: 150 },
            { label: '250+ mi', miles: 250 },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => onChange(b.miles)}
              style={{
                ...chipBase,
                borderColor: value === b.miles ? 'var(--accent)' : 'var(--border)',
                background: value === b.miles ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: value === b.miles ? 'var(--accent)' : 'var(--text)',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function fmt(n) {
  return '$' + Math.round(Number(n)).toLocaleString()
}

function negotiatedCost(h) {
  return h.negotiated_rate_total ?? h.negotiated_rate ?? h.price?.negotiated ?? 0
}

function oopCost(h) {
  return h.estimated_oop_total ?? h.estimatedOOP ?? h.estimated_oop ?? null
}

function cardCost(h, isCashPay, mode = 'negotiated') {
  if (isCashPay) return h.price?.cash ?? h.cash_price ?? negotiatedCost(h)
  if (mode === 'oop') return oopCost(h) ?? negotiatedCost(h)
  return negotiatedCost(h)
}

function tierLabel(tier) {
  if (!tier) return 'Near midpoint'
  return tier
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function tierColor(tier) {
  switch (tier) {
    case 'significantly_lower':
      return '#2d6a4f'
    case 'slightly_lower':
      return '#3d7348'
    case 'near_midpoint':
      return '#6b7280'
    case 'slightly_higher':
      return '#c8751c'
    case 'significantly_higher':
      return '#c0392b'
    default:
      return 'var(--text-2)'
  }
}

function priceComparison(cost, midpoint) {
  if (!midpoint || midpoint === 0) return { label: '', color: '' }
  const ratio = cost / midpoint
  if (ratio < 0.7) return { label: 'Significantly lower', color: 'var(--green)', arrow: 'down' }
  if (ratio < 0.95) return { label: 'Slightly lower', color: 'var(--green)', arrow: 'down' }
  if (ratio > 1.4) return { label: 'Significantly higher', color: 'var(--red)', arrow: 'up' }
  if (ratio > 1.05) return { label: 'Slightly higher', color: 'var(--red)', arrow: 'up' }
  return { label: 'Near midpoint', color: 'var(--text-3)', arrow: '' }
}

function verificationMeta(h) {
  const source = h?.verificationSource || h?.verification_source || 'modeled'
  const confidence = String(h?.price_confidence || '').toLowerCase()
  if (source === 'insurance') {
    return {
      label: 'Price source: Insurance-negotiated data',
      details: 'Backed by payer-linked contracted rates',
      docsUrl: 'https://www.cms.gov/healthplan-price-transparency',
    }
  }
  if (source === 'hospital') {
    return {
      label: 'Price source: Hospital MRF data',
      details: confidence === 'high' ? 'Cross-checked against network evidence' : 'Parsed from published hospital files',
      docsUrl: 'https://www.cms.gov/hospital-price-transparency',
    }
  }
  return {
    label: 'Price source: Modeled from public data',
    details: 'Derived from published rates and mappings',
    docsUrl: 'https://www.cms.gov/hospital-price-transparency',
  }
}

function starDisplay(stars) {
  const s = Math.min(5, Math.max(0, Math.round(stars || 0)))
  if (s === 0) return 'No rating'
  return '\u2605'.repeat(s) + '\u2606'.repeat(5 - s)
}

function getDirectionsUrl(hospital) {
  const query = `${hospital?.name || ''} ${hospital?.address_line1 || ''} ${hospital?.city || ''} ${hospital?.state || ''}`.trim()
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`
}

function getMapSearchUrl(hospital) {
  const query = `${hospital?.name || ''} ${hospital?.address_line1 || ''} ${hospital?.city || ''} ${hospital?.state || ''}`.trim()
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function providerWebsite(hospital) {
  const q = `${hospital?.name || ''} ${hospital?.city || ''} ${hospital?.state || ''} official website`
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

function normalizeApiHospital(h) {
  if (!h || typeof h !== 'object') return null
  const neg = Number(h.negotiated_rate ?? h.negotiated_rate_total ?? 0) || 0 // tolerate null rates from API
  return {
    ...h,
    id: h.ccn,
    price: {
      cash: h.cash_price,
      negotiated: h.negotiated_rate,
      gross: Math.round(neg * 1.12),
      implant: 0,
    },
    estimatedOOP: h.estimated_oop,
    networkStatus: h.network_status ?? 'unknown',
    verificationSource: h.verification_source ?? 'hospital',
    priceTier: h.price_position_tier ?? null,
    oopTier: h.oop_position_tier ?? null,
  }
}

function buildDistribution(costs, binCount = 20) {
  if (!costs.length) return []
  const min = Math.min(...costs)
  const max = Math.max(...costs)
  const span = Math.max(1, max - min)
  const bins = new Array(binCount).fill(0)
  for (const c of costs) {
    const idx = Math.min(binCount - 1, Math.floor(((c - min) / span) * binCount))
    bins[idx] += 1
  }
  return bins
}

function buildLongOverview(base, procedureName) {
  const context = `Typical episode-of-care pricing for ${procedureName} may include facility fees, professional fees, anesthesia when applicable, imaging or pathology, and routine follow-up services. Exact components vary by provider, setting, and clinical complexity.`
  const prep = 'Before scheduling, confirm expected pre-procedure steps (labs, imaging, medication adjustments, fasting, transportation, and prior authorization) because these steps can affect both timing and total cost.'
  const recovery = 'Recovery expectations differ by procedure type, but patients should ask about same-day discharge versus overnight observation, anticipated activity restrictions, rehabilitation needs, and post-procedure warning signs that require urgent follow-up.'
  const billing = 'For financial planning, verify whether quoted amounts include all related clinicians and ancillary services, and ask how unexpected findings or added services are billed to avoid surprise out-of-pocket changes.'
  return `${base} ${context} ${prep} ${recovery} ${billing}`
}

function readPersistedSearchState() {
  try {
    const raw = sessionStorage.getItem('anacare:lastSearchState')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * React Router `location.state` is only nullish when absent — but some navigations
 * leave a truthy empty object {}, which made `state ?? sessionStorage` skip persisted
 * search from HomePage ("Compare prices") so /results never called the API.
 */
function resolveSearchState(routerState, persisted) {
  const p = persisted && typeof persisted === 'object' && !Array.isArray(persisted) ? persisted : {}
  const r =
    routerState != null && typeof routerState === 'object' && !Array.isArray(routerState)
      ? routerState
      : null
  const procedureId = (s) => s?.procedures?.[0]?.id
  const rIsEmpty = r && Object.keys(r).length === 0

  if (r && procedureId(r)) return { ...p, ...r }
  if (procedureId(p)) return { ...p, ...(!rIsEmpty && r ? r : {}) }
  return r && !rIsEmpty ? { ...p, ...r } : p
}

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

export default function ResultsPage({ theme, onToggleTheme }) {
  const location = useLocation()
  const navigate = useNavigate()
  const searchState = useMemo(
    () => resolveSearchState(location.state, readPersistedSearchState()),
    [location.state, location.key],
  )

  const stateZip = searchState.location?.zip || ''
  const searchRadiusMiles = searchState.location?.radius_miles || 25
  const searchPlanId = searchState.plan?.plan_id || null

  const [sortBy, setSortBy] = useState('lowest_cost')
  const [visibleCount, setVisibleCount] = useState(20)
  const [selectedHospital, setSelectedHospital] = useState(null)
  const [mapPreviewHospital, setMapPreviewHospital] = useState(null)
  const [cmsRatingHelpOpen, setCmsRatingHelpOpen] = useState(false)
  const [billingHelpOpen, setBillingHelpOpen] = useState(false)
  const [dataSource, setDataSource] = useState(null)
  const [apiMeta, setApiMeta] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchReady, setSearchReady] = useState(false)
  const [episodeDetail, setEpisodeDetail] = useState(null)
  const [showFullOverview, setShowFullOverview] = useState(false)
  const [midpointLens, setMidpointLens] = useState('negotiated')
  const [hospitalNameQuery, setHospitalNameQuery] = useState('')
  const [valueWeight, setValueWeight] = useState(0.55)
  const [radiusMiles, setRadiusMiles] = useState(searchRadiusMiles || 25)
  const [noResultsModalOpen, setNoResultsModalOpen] = useState(false)
  const [modalRadius, setModalRadius] = useState(50)

  // Filters
  const [distanceFilter, setDistanceFilter] = useState(null)
  const [qualityFilter, setQualityFilter] = useState(null)
  const [includeUnrated, setIncludeUnrated] = useState(true)
  const [distanceFilterDraft, setDistanceFilterDraft] = useState(null)
  const [qualityFilterDraft, setQualityFilterDraft] = useState(null)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [filtersModalOpen, setFiltersModalOpen] = useState(false)
  const [distanceOpen, setDistanceOpen] = useState(false)
  const [qualityOpen, setQualityOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const [procedureModalOpen, setProcedureModalOpen] = useState(false)
  const [insuranceOpen, setInsuranceOpen] = useState(false)
  const [insuranceEditOnOpen, setInsuranceEditOnOpen] = useState(false)
  const [selectedInsurance, setSelectedInsurance] = useState(searchState.plan || null)
  const [activeHospitalId, setActiveHospitalId] = useState(null)
  const [procedureCategory, setProcedureCategory] = useState(null)
  const [zipValidation, setZipValidation] = useState({
    status: 'idle',
    message: '',
    city: '',
    stateAbbr: '',
  })
  const [geoLoading, setGeoLoading] = useState(false)

  const [searchProcedureInput, setSearchProcedureInput] = useState('')
  const [searchZipInput, setSearchZipInput] = useState('')
  const [selectedProcedure, setSelectedProcedure] = useState(searchState.procedures?.[0] || null)
  const [searchLocation, setSearchLocation] = useState({
    lat: searchState.location?.lat ?? null,
    lng: searchState.location?.lng ?? null,
    zip: searchState.location?.zip ?? '',
    city: '',
    state: '',
  })
  const procedureRef = useRef(null)
  const locationRef = useRef(null)
  const procedureInputRef = useRef(null)
  const zipInputRef = useRef(null)
  const distanceRef = useRef(null)
  const qualityRef = useRef(null)
  const priceRef = useRef(null)
  const hospitalCardRefs = useRef({})

  const procedureId = searchState.procedures?.[0]?.id
  const procedureName = searchState.procedures?.[0]?.name || 'Procedure'
  const activeProcedureId = selectedProcedure?.id || procedureId
  const activeProcedureName = selectedProcedure?.name || procedureName

  const plan = useMemo(() => {
    const p = selectedInsurance || searchState.plan || {}
    return {
      deductible_remaining: p.deductible_remaining ?? 0,
      oop_max_remaining: p.oop_max_remaining ?? 99999,
      coinsurance_pct: p.coinsurance_pct ?? 0.20,
      pc_copay: p.pc_copay ?? 0,
    }
  }, [
    selectedInsurance?.deductible_remaining,
    selectedInsurance?.oop_max_remaining,
    selectedInsurance?.coinsurance_pct,
    selectedInsurance?.pc_copay,
    searchState.plan?.deductible_remaining,
    searchState.plan?.oop_max_remaining,
    searchState.plan?.coinsurance_pct,
    searchState.plan?.pc_copay,
  ])

  const activePlan = selectedInsurance || searchState.plan || null
  const isCashPay = Boolean(activePlan?.isCashPay)
  const effectiveLens = isCashPay ? 'negotiated' : 'oop'
  const chartLens = isCashPay ? 'negotiated' : midpointLens

  useEffect(() => {
    if (isCashPay && midpointLens !== 'negotiated') {
      setMidpointLens('negotiated')
    }
    if (!isCashPay && midpointLens !== 'negotiated' && midpointLens !== 'oop') {
      setMidpointLens('negotiated')
    }
  }, [isCashPay, midpointLens])

  useEffect(() => {
    if (!selectedHospital) {
      setCmsRatingHelpOpen(false)
      setBillingHelpOpen(false)
    }
  }, [selectedHospital])

  useEffect(() => {
    const nextProcedure = searchState.procedures?.[0] || null
    const nextProcedureName = nextProcedure?.name || ''
    const nextZip = searchState.location?.zip || ''
    const nextLat = searchState.location?.lat ?? null
    const nextLng = searchState.location?.lng ?? null

    setSearchProcedureInput(nextProcedureName)
    setSearchZipInput(nextZip)
    setSelectedProcedure((prev) => {
      if ((prev?.id || null) === (nextProcedure?.id || null) && (prev?.name || '') === nextProcedureName) return prev
      return nextProcedure
    })
    setSearchLocation((prev) => {
      if (prev.lat === nextLat && prev.lng === nextLng && prev.zip === nextZip) return prev
      return { lat: nextLat, lng: nextLng, zip: nextZip, city: '', state: '' }
    })
    setProcedureCategory(null)
    setShowFullOverview(false)
  }, [searchState])

  const geocodeZip = useCallback(async (raw) => {
    if (raw.length < 5) return
    setZipValidation({ status: 'loading', message: '', city: '', stateAbbr: '' })
    try {
      const res = await fetch('https://api.zippopotam.us/us/' + raw)
      if (!res.ok) {
        setZipValidation({ status: 'invalid', message: 'Invalid ZIP code.', city: '', stateAbbr: '' })
        setSearchLocation(prev => ({ ...prev, lat: null, lng: null, zip: raw, city: '', state: '' }))
        return
      }
      const geo = await res.json()
      const place = geo.places?.[0]
      if (!place) {
        setZipValidation({ status: 'invalid', message: 'Invalid ZIP code.', city: '', stateAbbr: '' })
        setSearchLocation(prev => ({ ...prev, lat: null, lng: null, zip: raw, city: '', state: '' }))
        return
      }
      const city = place['place name'] ?? ''
      const stateAbbr = (place['state abbreviation'] ?? '').toUpperCase()
      setSearchLocation({
        lat: parseFloat(place.latitude),
        lng: parseFloat(place.longitude),
        zip: raw,
        city,
        state: stateAbbr,
      })
      setZipValidation({ status: 'valid', message: '', city, stateAbbr })
    } catch {
      setZipValidation({ status: 'invalid', message: 'Could not verify ZIP code.', city: '', stateAbbr: '' })
      setSearchLocation(prev => ({ ...prev, lat: null, lng: null, zip: raw, city: '', state: '' }))
    }
  }, [])

  const useCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try {
          const res = await fetch(apiUrl(`/zipcodes/nearest?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`))
          if (!res.ok) throw new Error('nearest_zip')
          const j = await res.json()
          const zip = String(j.zip ?? '').replace(/\D/g, '').slice(0, 5)
          const latN = typeof j.lat === 'number' ? j.lat : lat
          const lngN = typeof j.lng === 'number' ? j.lng : lng
          if (zip.length === 5) {
            setSearchZipInput(zip)
            setSearchLocation({
              lat: latN,
              lng: lngN,
              zip,
              city: j.city || '',
              state: (j.state || '').toUpperCase(),
            })
            setZipValidation({
              status: 'valid',
              message: '',
              city: j.city || '',
              stateAbbr: (j.state || '').toUpperCase().slice(0, 2),
            })
          } else {
            setSearchZipInput('')
            setSearchLocation({ lat, lng, zip: '', city: '', state: '' })
            setZipValidation({ status: 'idle', message: '', city: '', stateAbbr: '' })
          }
        } catch {
          setSearchZipInput('')
          setSearchLocation({ lat, lng, zip: '', city: '', state: '' })
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

  useEffect(() => {
    if (searchLocation.lat != null && searchLocation.lng != null) return
    const zip = (searchLocation.zip || stateZip || '').trim()
    if (zip.length === 5) geocodeZip(zip)
  }, [searchLocation.lat, searchLocation.lng, searchLocation.zip, stateZip, geocodeZip])

  const procedureOptions = useMemo(() => {
    const q = searchProcedureInput.trim()
    if (!q) return ALL_PROCEDURES
    return searchProcedures(q)
  }, [searchProcedureInput])

  useEffect(() => {
    const onDocClick = (e) => {
      if (distanceRef.current && !distanceRef.current.contains(e.target)) setDistanceOpen(false)
      if (qualityRef.current && !qualityRef.current.contains(e.target)) setQualityOpen(false)
      if (priceRef.current && !priceRef.current.contains(e.target)) setPriceOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (distanceOpen) setDistanceFilterDraft(distanceFilter)
  }, [distanceOpen, distanceFilter])

  useEffect(() => {
    if (qualityOpen) setQualityFilterDraft(qualityFilter)
  }, [qualityOpen, qualityFilter])

  useEffect(() => {
    let cancelled = false
    async function runSearch() {
      const queryLat = searchLocation.lat
      const queryLng = searchLocation.lng
      const resolvedZip = String(searchLocation.zip || stateZip || '').replace(/\D/g, '').slice(0, 5)
      const zipOk = resolvedZip.length === 5
      const hasCoords = queryLat != null && queryLng != null
      console.log('[runSearch]', { activeProcedureId, queryLat, queryLng, resolvedZip, zipOk, hasCoords, stateZip, searchLocationZip: searchLocation.zip })
      // Backend geocodes ZIP when lat/lng are omitted; the client previously skipped the POST
      // until zippopotam finished, which left /results empty with searchReady true and no rows.
      if (!activeProcedureId || (!hasCoords && !zipOk)) {
        console.log('[runSearch] SKIPPING search:', { activeProcedureId, hasCoords, zipOk })
        if (cancelled) return
        setDataSource(null)
        setApiMeta(null)
        setSearchError('')
        setSearchReady(true)
        return
      }
      setLoading(true)
      setSearchReady(false)
      try {
        setSearchError('')
        const res = await fetch(apiUrl('/v2/search/hospitals'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            procedure_id: activeProcedureId,
            zip: resolvedZip || (searchLocation.zip || stateZip || ''),
            lat: hasCoords ? queryLat : null,
            lng: hasCoords ? queryLng : null,
            radius_miles: radiusMiles,
            plan_id: searchPlanId,
            cash_pay: isCashPay,
            benefits_opt_in: !isCashPay,
            deductible_remaining: plan.deductible_remaining,
            oop_max_remaining: plan.oop_max_remaining,
            coinsurance_pct: plan.coinsurance_pct,
            pc_copay: plan.pc_copay,
            sort_by: 'lowest_cost',
            north: null,
            south: null,
            east: null,
            west: null,
          }),
        })
        if (cancelled) return
        if (!res.ok) {
          let detail = `Search failed (${res.status})`
          try {
            const err = await res.json()
            if (err?.detail) detail = String(err.detail)
          } catch (e) {
            void e
          }
          throw new Error(detail)
        }
        const data = await res.json()
        console.log('[runSearch] API response:', { status: res.status, total_count: data.total_count, hospitalCount: data.hospitals?.length })
        if (cancelled) return
        if (data.total_count > 0) {
          setApiMeta(data)
          setDataSource('api')
          setSearchError('')
        } else {
          console.log('[runSearch] 0 results from API')
          setApiMeta(null)
          setDataSource('api')
          setSearchError('')
        }
      } catch (err) {
        console.error('[runSearch] ERROR:', err)
        if (cancelled) return
        setApiMeta(null)
        setDataSource(null)
        setSearchError(err?.message || 'Unable to fetch pricing right now.')
      } finally {
        if (!cancelled) {
        setLoading(false)
        setSearchReady(true)
        }
      }
    }
    runSearch()
    return () => { cancelled = true }
  }, [
    activeProcedureId,
    searchLocation.lat,
    searchLocation.lng,
    searchLocation.zip,
    stateZip,
    radiusMiles,
    searchPlanId,
    isCashPay,
    plan.deductible_remaining,
    plan.oop_max_remaining,
    plan.coinsurance_pct,
    plan.pc_copay,
  ])

  const baseList = useMemo(() => {
    if (!searchReady) return []
    if (dataSource === 'api' && apiMeta?.hospitals?.length) {
      return apiMeta.hospitals.map(normalizeApiHospital).filter(Boolean)
    }
    return []
  }, [searchReady, dataSource, apiMeta])

  // Only after a real API attempt returned zero rows — not when search was skipped (missing ZIP/coords).
  useEffect(() => {
    if (
      searchReady &&
      !loading &&
      baseList.length === 0 &&
      !searchError &&
      activeProcedureId &&
      dataSource === 'api'
    ) {
      setModalRadius(radiusMiles)
      setNoResultsModalOpen(true)
    }
  }, [searchReady, loading, baseList.length, searchError, activeProcedureId, dataSource, radiusMiles])

  // Apply filters
  const filtered = useMemo(() => {
    let arr = [...baseList]

    if (distanceFilter) {
      arr = arr.filter(h => h.distance != null && h.distance <= distanceFilter)
    }

    if (qualityFilter) {
      arr = arr.filter(h => {
        const stars = h.cms_stars ?? 0
        if (stars === 0 && includeUnrated) return true
        return stars >= qualityFilter
      })
    }

    const pMin = parseInt(priceMin) || 0
    const pMax = parseInt(priceMax) || Infinity
    if (pMin > 0 || pMax < Infinity) {
      arr = arr.filter(h => {
        const cost = cardCost(h, isCashPay, effectiveLens)
        return cost >= pMin && cost <= pMax
      })
    }

    return arr
  }, [baseList, distanceFilter, qualityFilter, includeUnrated, priceMin, priceMax, isCashPay, effectiveLens])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sortBy) {
      case 'lowest_cost':
        return arr.sort((a, b) => cardCost(a, isCashPay, effectiveLens) - cardCost(b, isCashPay, effectiveLens))
      case 'top_rated':
        return arr.sort((a, b) => (b.cms_stars ?? 0) - (a.cms_stars ?? 0))
      case 'nearest':
        return arr.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999))
      case 'best_value': {
        const priced = arr.map((h) => ({ h, cost: cardCost(h, isCashPay, effectiveLens) }))
        const validCosts = priced.map((x) => x.cost).filter((c) => Number.isFinite(c) && c > 0)
        const min = validCosts.length ? Math.min(...validCosts) : 0
        const max = validCosts.length ? Math.max(...validCosts) : 1
        const span = max - min || 1
        const qWeight = Math.max(0, Math.min(1, valueWeight))
        const pWeight = 1 - qWeight
        return arr.sort((a, b) => {
          const costA = cardCost(a, isCashPay, effectiveLens)
          const costB = cardCost(b, isCashPay, effectiveLens)
          const costNormA = (costA - min) / span
          const costNormB = (costB - min) / span
          const qualA = (a.cms_stars ?? 0) / 5
          const qualB = (b.cms_stars ?? 0) / 5
          const scoreA = (pWeight * (1 - costNormA)) + (qWeight * qualA)
          const scoreB = (pWeight * (1 - costNormB)) + (qWeight * qualB)
          return scoreB - scoreA
        })
      }
      default:
        return arr
    }
  }, [filtered, sortBy, isCashPay, effectiveLens, valueWeight])

  const searchedSorted = useMemo(() => {
    const q = hospitalNameQuery.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((h) => (h.name || '').toLowerCase().includes(q))
  }, [sorted, hospitalNameQuery])

  const stats = useMemo(() => {
    const costs = baseList.map(h => cardCost(h, isCashPay, effectiveLens)).filter(c => c > 0)
    if (!costs.length) return { min: 0, max: 0, midpoint: 0 }
    const sortedCosts = [...costs].sort((a, b) => a - b)
    const n = sortedCosts.length
    const mid = n % 2 ? sortedCosts[(n - 1) / 2] : (sortedCosts[n / 2 - 1] + sortedCosts[n / 2]) / 2
    return { min: sortedCosts[0], max: sortedCosts[n - 1], midpoint: mid }
  }, [baseList, isCashPay, effectiveLens])

  const chartStats = useMemo(() => {
    const costs = searchedSorted
      .map((h) => (chartLens === 'negotiated' ? negotiatedCost(h) : (oopCost(h) ?? negotiatedCost(h))))
      .filter(c => c > 0)
    if (!costs.length) return { min: 0, max: 0, midpoint: 0, bins: [], markerPct: 50 }
    const ordered = [...costs].sort((a, b) => a - b)
    const n = ordered.length
    const midpoint = n % 2 ? ordered[(n - 1) / 2] : (ordered[n / 2 - 1] + ordered[n / 2]) / 2
    const min = ordered[0]
    const max = ordered[n - 1]
    const span = Math.max(1, max - min)
    const markerPct = ((midpoint - min) / span) * 100
    return {
      min,
      max,
      midpoint,
      bins: buildDistribution(ordered, 22),
      markerPct: Math.min(100, Math.max(0, markerPct)),
    }
  }, [searchedSorted, chartLens])

  const cptCode = apiMeta?.cpt_code || null
  const packageRows = apiMeta?.package_rows || []
  const nsaTimeline = apiMeta?.nsa_timeline || []
  const usesOrCharges = apiMeta?.uses_operating_room_charges !== false
  const modeledPackagePrices = useMemo(() => {
    if (!packageRows.length || !selectedHospital) return []
    const neg = Number(negotiatedCost(selectedHospital) || 0)
    const surgeryItems = episodeDetail?.episode?.surgery_items || []
    const preopItems = episodeDetail?.episode?.preop_items || []
    const postopItems = episodeDetail?.episode?.postop_items || []
    const lineItems = [...preopItems, ...surgeryItems, ...postopItems]

    const explicitByCode = new Map()
    lineItems.forEach((item) => {
      const code = String(item?.cpt || '').trim().toUpperCase()
      if (!code) return
      explicitByCode.set(code, (explicitByCode.get(code) || 0) + Number(item.gross_cost || 0))
    })

    const facSurg = surgeryItems.find((x) => /facility/i.test(x.name || '') && !/professional|surgeon/i.test(x.name || ''))
    const profSurg = surgeryItems.find((x) => {
      const n = String(x.name || '').toLowerCase()
      return n.includes('surgeon') || n.includes('professional')
    })
    const anesSurg = surgeryItems.find((x) => /^anesthesia$/i.test(String(x.name || '').trim()))

    const facilityPool = Number(
      facSurg?.gross_cost ?? (usesOrCharges ? neg * 0.55 : neg * 0.65),
    )
    const professionalPool = Number(
      profSurg?.gross_cost ?? (usesOrCharges ? neg * 0.30 : neg * 0.35),
    )
    let anesthesiaPool = Number(anesSurg?.gross_cost || 0)
    if (anesthesiaPool <= 0 && usesOrCharges && surgeryItems.length) {
      anesthesiaPool = neg * 0.054
    }
    const totalEpisodeGross = lineItems.reduce((sum, row) => sum + Number(row?.gross_cost || 0), 0) || neg
    const otherPool = Math.max(0, totalEpisodeGross - facilityPool - professionalPool - anesthesiaPool)

    const classify = (row) => {
      const text = `${row.code_type || ''} ${row.description || ''}`.toLowerCase()
      if (text.includes('anesthesia')) return 'anesthesia'
      if (text.includes('surgeon') || text.includes('professional')) return 'professional'
      if (text.includes('facility') || text.includes('technical') || text.includes('operating room') || text.includes('recovery room')) return 'facility'
      if (text.includes('consult')) return 'professional'
      return 'other'
    }

    const explicitForRow = (row) => {
      const code = String(row.code || '').trim().toUpperCase()
      const desc = String(row.description || '').toLowerCase()
      if (!code) return 0
      const sameCptSurgery = surgeryItems.filter(
        (s) => String(s.cpt || '').trim().toUpperCase() === code,
      )
      if (sameCptSurgery.length >= 2) {
        if (desc.includes('professional') || desc.includes('surgeon')) {
          return Number(
            sameCptSurgery.find((s) => /professional|surgeon/i.test(s.name || ''))?.gross_cost || 0,
          )
        }
        if (desc.includes('facility') || desc.includes('technical')) {
          return Number(
            sameCptSurgery.find((s) => /facility|technical/i.test(s.name || ''))?.gross_cost || 0,
          )
        }
      }
      return Number(explicitByCode.get(code) || 0)
    }

    const missingCounts = { facility: 0, professional: 0, anesthesia: 0, other: 0 }
    packageRows.forEach((row) => {
      if (explicitForRow(row) > 0) return
      missingCounts[classify(row)] += 1
    })

    const poolByType = {
      facility: facilityPool,
      professional: professionalPool,
      anesthesia: anesthesiaPool,
      other: otherPool,
    }

    return packageRows.map((row) => {
      const explicit = explicitForRow(row)
      if (explicit > 0) return { ...row, modeled_price: explicit }
      const type = classify(row)
      const count = Math.max(1, missingCounts[type])
      return { ...row, modeled_price: poolByType[type] / count }
    })
  }, [packageRows, selectedHospital, episodeDetail, usesOrCharges])

  useEffect(() => {
    if (!selectedHospital?.ccn || !cptCode || isCashPay) {
      setEpisodeDetail(null)
      return
    }
    let cancelled = false
    const q = new URLSearchParams({
      cpt_code: cptCode,
      deductible: String(plan.deductible_remaining),
      oop_max: String(plan.oop_max_remaining),
    })
    if (activePlan?.plan_id) q.set('plan_id', activePlan.plan_id)

    q.set('benefits_opt_in', 'true')
    q.set('deductible_remaining', String(plan.deductible_remaining))
    q.set('oop_max_remaining', String(plan.oop_max_remaining))
    fetch(apiUrl(`/v2/providers/${selectedHospital.ccn}/episode?${q}`))
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data) setEpisodeDetail(data)
      })
      .catch(() => {
        if (!cancelled) setEpisodeDetail(null)
      })

    return () => { cancelled = true }
  }, [selectedHospital?.ccn, cptCode, isCashPay, plan.deductible_remaining, plan.oop_max_remaining, searchPlanId])

  const handleHospitalSelectFromMap = useCallback((hospital) => {
    const key = hospital?.id || hospital?.ccn
    if (!key) return
    const idx = sorted.findIndex((h) => (h.id || h.ccn) === key)
    if (idx >= 0 && idx + 1 > visibleCount) {
      setVisibleCount(idx + 1)
    }
    setActiveHospitalId(key)
    setMapPreviewHospital(hospital)
    setTimeout(() => {
      const el = hospitalCardRefs.current[key]
      if (el?.scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 0)
  }, [sorted, visibleCount])

  const getMapCost = useCallback((h) => negotiatedCost(h), [])

  console.log('[ResultsPage render]', { activeProcedureId, searchReady, loading, dataSource, baseListLen: baseList.length, searchedSortedLen: searchedSorted.length, searchError })
  if (!activeProcedureId) {
    return (
      <>
        <Header planName={searchState.plan?.plan?.payer} theme={theme} onToggleTheme={onToggleTheme} />
        <div style={{
          maxWidth: 600, margin: '120px auto', textAlign: 'center', padding: '0 24px',
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            No procedure selected
          </h2>
          <p style={{ color: 'var(--text-2)', marginBottom: 24 }}>
            Go back and select a procedure to see pricing results.
          </p>
          <button type="button" onClick={() => navigate('/home', { state: readPersistedSearchState() })} style={{
            background: 'var(--accent)', color: 'var(--accent-text)',
            border: 'none', borderRadius: 'var(--radius-lg)', padding: '12px 28px',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Back to search
          </button>
        </div>
      </>
    )
  }

  const descText = PROCEDURE_DESCRIPTIONS[activeProcedureId] || ''
  const fullOverviewText = descText ? buildLongOverview(descText, activeProcedureName) : ''
  const truncatedOverviewText = (() => {
    if (!fullOverviewText) return ''
    if (fullOverviewText.length <= 340) return fullOverviewText
    return `${fullOverviewText.slice(0, 340).trim()}...`
  })()

  const otherProviders = searchedSorted.filter(h => (h.ccn || h.id) !== (selectedHospital?.ccn || selectedHospital?.id)).slice(0, 4)
  const stackRatio = stats.max > stats.min
    ? Math.max(0, Math.min(1, (cardCost(selectedHospital || {}, isCashPay, effectiveLens) - stats.min) / (stats.max - stats.min)))
    : 0.5
  const cmsNumeric = Number(selectedHospital?.cms_stars || 0).toFixed(1)
  const cmsText = Number(selectedHospital?.cms_stars || 0) > 0 ? starDisplay(selectedHospital?.cms_stars) : 'No Rating'
  const canCompareSearch = !!selectedProcedure?.id && searchLocation.lat != null && searchLocation.lng != null
  const backPrefillState = {
    prefill: {
      procedures: [{ id: selectedProcedure?.id || activeProcedureId, name: selectedProcedure?.name || activeProcedureName }],
      location: {
        lat: searchLocation.lat ?? searchState.location?.lat ?? null,
        lng: searchLocation.lng ?? searchState.location?.lng ?? null,
        zip: searchLocation.zip || searchState.location?.zip || '',
        radius_miles: radiusMiles,
      },
      plan: selectedInsurance || searchState.plan || null,
    },
  }

  function handleCompareSearch() {
    if (!canCompareSearch) return
    const nextState = {
      procedures: [{ id: selectedProcedure.id, name: selectedProcedure.name }],
      location: {
        lat: searchLocation.lat,
        lng: searchLocation.lng,
        zip: searchLocation.zip,
        radius_miles: radiusMiles,
      },
      plan: {
        plan_id: selectedInsurance?.plan_id || null,
        plan: selectedInsurance?.plan || null,
        deductible_remaining: selectedInsurance?.deductible_remaining ?? null,
        oop_max_remaining: selectedInsurance?.oop_max_remaining ?? null,
        coinsurance_pct: selectedInsurance?.coinsurance_pct ?? 0.20,
        pc_copay: selectedInsurance?.pc_copay ?? 0,
        isCashPay: selectedInsurance?.isCashPay ?? false,
        benefits_enabled: !Boolean(selectedInsurance?.isCashPay),
      },
    }
    try {
      sessionStorage.setItem('anacare:lastSearchState', JSON.stringify(nextState))
    } catch {
      /* ignore quota / private mode */
    }
    navigate('/results', { state: nextState })
  }

  return (
    <>
      <style>{`
        .radius-slider {
          --slider-track: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #22c55e 30%));
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: var(--surface-2);
          outline: none;
          cursor: pointer;
          position: relative;
        }
        .radius-slider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--surface-2) 0%, var(--surface-2) 100%);
        }
        .radius-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent 75%), 0 2px 8px rgba(0,0,0,0.18);
          cursor: pointer;
          margin-top: -8px;
          transition: box-shadow 180ms ease, transform 180ms ease;
        }
        .radius-slider::-webkit-slider-thumb:hover {
          transform: scale(1.12);
          box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 30%, transparent 70%), 0 2px 12px rgba(0,0,0,0.22);
        }
        .radius-slider::-moz-range-track {
          height: 6px;
          border-radius: 999px;
          background: var(--surface-2);
        }
        .radius-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent 75%), 0 2px 8px rgba(0,0,0,0.18);
          cursor: pointer;
          transition: box-shadow 180ms ease, transform 180ms ease;
        }
        .radius-slider::-moz-range-thumb:hover {
          transform: scale(1.12);
          box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 30%, transparent 70%), 0 2px 12px rgba(0,0,0,0.22);
        }
        .radius-slider-container {
          position: relative;
          padding: 0 2px;
        }
        .radius-slider-fill {
          position: absolute;
          top: 50%;
          left: 2px;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #22c55e 30%));
          transform: translateY(-50%);
          pointer-events: none;
          z-index: 0;
        }
        .radius-slider-ticks {
          display: flex;
          justify-content: space-between;
          padding: 0 2px;
          margin-top: 6px;
        }
        .radius-slider-tick {
          font-size: 10px;
          color: var(--text-3);
          min-width: 0;
          text-align: center;
        }
        .no-results-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: nrFadeIn 250ms ease forwards;
        }
        @keyframes nrFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes nrScaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .no-results-modal {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 36px 32px 28px;
          max-width: 440px;
          width: calc(100% - 32px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px color-mix(in srgb, var(--border) 50%, transparent 50%);
          animation: nrScaleIn 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          text-align: center;
        }
        .no-results-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: color-mix(in srgb, var(--accent) 12%, var(--surface-2) 88%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }
        .result-card {
          background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 92%, #ffffff 8%) 0%, var(--surface) 100%);
          border: 1px solid color-mix(in srgb, var(--border) 85%, #ffffff 15%);
          border-radius: 15px; padding: 14px 16px;
          cursor: pointer; box-shadow: var(--shadow-sm);
          transition: all 180ms ease; position: relative;
        }
        .result-card:hover {
          box-shadow: var(--shadow-md); transform: translateY(-1px); border-color: color-mix(in srgb, var(--accent) 60%, var(--border) 40%);
        }
        .result-card-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
        }
        .result-card-name {
          font-size: 22px;
          line-height: 1.12;
          letter-spacing: -0.01em;
          font-weight: 650;
          color: var(--text);
          margin: 0;
        }
        .result-card-meta {
          margin-top: 6px;
          font-size: 13px;
          color: var(--text-3);
        }
        .result-card-badges {
          margin-top: 9px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .result-chip {
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          line-height: 1;
          font-weight: 600;
          background: var(--surface-2);
          color: var(--text-2);
        }
        .result-card-price {
          text-align: right;
          min-width: 180px;
        }
        .result-card-price-label {
          font-size: 11px;
          color: var(--text-3);
        }
        .result-card-price-value {
          margin-top: 2px;
          font-size: 34px;
          line-height: 1.02;
          font-weight: 740;
          letter-spacing: -0.02em;
          color: var(--accent);
        }
        .result-card-oop {
          margin-top: 6px;
          font-size: 14px;
          color: var(--text-2);
        }
        .result-card-footer {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid color-mix(in srgb, var(--border) 75%, transparent 25%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .result-evidence {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          font-size: 11px;
          color: var(--text-3);
        }
        .result-evidence a {
          color: var(--accent);
          text-decoration: none;
          font-weight: 600;
        }
        .result-tier {
          font-size: 12px;
          font-weight: 650;
        }
        @media (max-width: 1024px) {
          .results-layout {
            grid-template-columns: 1fr !important;
          }
          .results-map-col {
            position: static !important;
          }
          .result-card-name {
            font-size: 20px;
          }
          .result-card-price-value {
            font-size: 30px;
          }
        }
        @media (max-width: 768px) {
          .results-container { padding: 24px 16px 48px !important; }
          .top-search-inner, .top-filter-inner {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
          .top-search-bar {
            grid-template-columns: 1fr !important;
          }
          .top-search-cell {
            border-right: none !important;
            border-bottom: 1px solid var(--border);
            min-height: 52px !important;
          }
          .top-search-cell:last-of-type {
            border-bottom: none;
          }
          .top-filter-row {
            justify-content: flex-start !important;
          }
          .filter-pill {
            flex: 1 1 calc(50% - 6px);
          }
          .split-summary-row {
            grid-template-columns: 1fr !important;
          }
          .result-card-main {
            grid-template-columns: 1fr;
          }
          .result-card-price {
            text-align: left;
            min-width: 0;
          }
          .result-card-price-value {
            font-size: 28px;
          }
          .result-card-footer {
            align-items: flex-start;
          }
        }
        .drawer-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          z-index: 900; opacity: 0; transition: opacity 200ms ease;
        }
        .drawer-overlay.open { opacity: 1; }
        .drawer-panel {
          position: fixed; top: 0; right: 0; width: min(520px, 100vw);
          height: 100vh; background: var(--bg); z-index: 901; overflow-y: auto;
          transform: translateX(100%); transition: transform 300ms ease;
          box-shadow: -8px 0 32px rgba(0,0,0,0.35); border-left: 1px solid var(--border);
        }
        .drawer-panel.open { transform: translateX(0); }
        .filter-section {
          padding: 12px 16px; background: var(--surface-2); border-radius: var(--radius-lg);
          border: 1px solid var(--border);
        }
        .filter-btn {
          border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius);
          padding: 6px 14px; cursor: pointer; font-size: 13px; font-family: inherit;
          color: var(--text-2); transition: all 150ms ease;
        }
        .filter-btn.active {
          background: var(--accent); color: var(--accent-text); border-color: var(--accent);
        }
        .pkg-table th, .pkg-table td {
          padding: 10px 12px; font-size: 12px; border-bottom: 1px solid var(--border); text-align: left;
        }
        .pkg-table th { background: var(--surface-2); color: var(--text-2); font-weight: 600; }
        .top-search-shell {
          position: relative;
          background: var(--page-canvas, var(--bg)); border-bottom: 1px solid var(--border);
          margin-top: 56px;
        }
        .top-search-inner {
          max-width: 1200px; margin: 0 auto; padding: 8px 32px;
        }
        .top-search-bar {
          display: grid; grid-template-columns: 1.5fr 0.9fr 1.05fr auto;
          border: 1px solid var(--border); border-radius: 12px;
          background: var(--surface); overflow: visible;
        }
        .top-search-cell {
          border-right: 1px solid var(--border);
          min-height: 54px;
          display: flex;
          align-items: center;
          padding: 0 14px;
          gap: 8px;
          cursor: text;
        }
        .top-search-cell:last-of-type { border-right: none; }
        .top-search-input {
          border: none; outline: none; background: transparent;
          color: var(--text); width: 100%; font-size: 15px; font-family: inherit;
        }
        .top-compare-btn {
          margin: 8px;
          padding: 0 18px;
          min-width: 160px;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          background: var(--accent);
          color: var(--accent-text);
        }
        .top-compare-btn:disabled {
          background: var(--surface-3);
          color: var(--text-3);
          cursor: not-allowed;
        }
        .top-search-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow-lg);
          max-height: 320px;
          overflow-y: auto;
          z-index: 110;
        }
        .top-search-dropdown-item {
          padding: 10px 12px;
          border-bottom: 1px solid var(--surface-2);
          font-size: 14px;
          color: var(--text);
          cursor: pointer;
        }
        .top-search-dropdown-item:hover { background: var(--surface-2); }
        .dropdown-header {
          padding: 10px 12px 6px;
          font-size: 11px;
          color: var(--text-3);
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .search-modal {
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(760px, calc(100vw - 24px));
          max-height: 84vh;
          overflow-y: auto;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: var(--shadow-lg);
          z-index: 930;
        }
        .top-filter-shell {
          position: relative;
          background: var(--page-canvas, var(--bg)); border-bottom: 1px solid var(--border);
        }
        .top-filter-inner {
          max-width: 1200px; margin: 0 auto; padding: 10px 32px;
        }
        .top-filter-row {
          display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: center;
        }
        .filter-trigger {
          height: 42px; padding: 0 16px; border-radius: 10px; cursor: pointer;
          border: 1px solid var(--border); background: var(--surface); color: var(--text);
          font-size: 14px; font-weight: 500; font-family: inherit;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-width: 164px;
        }
        .filter-pill {
          height: 42px; padding: 0 14px; border-radius: 10px; cursor: pointer;
          border: 1px solid var(--border); background: var(--surface); color: var(--accent);
          font-size: 14px; font-weight: 500; font-family: inherit;
          display: inline-flex; align-items: center; justify-content: space-between; gap: 10px;
          min-width: 190px;
          position: relative;
        }
        .filter-popover {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow-lg);
          min-width: 260px;
          z-index: 115;
          padding: 10px;
          color: var(--text);
          text-align: left;
        }
        .filter-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.44); z-index: 920;
        }
        .filter-modal {
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(720px, calc(100vw - 28px));
          max-height: min(86vh, 780px);
          background: var(--surface);
          z-index: 921;
          overflow-y: auto;
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: 0 16px 44px rgba(0,0,0,0.28);
        }
        .filter-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 18px; border-bottom: 1px solid var(--border);
        }
        .filter-modal-section {
          padding: 16px 18px; border-bottom: 1px solid var(--border);
        }
        .filter-option {
          display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
          font-size: 14px; color: var(--text);
        }
        .price-summary-chart {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          padding: 18px;
          margin-bottom: 20px;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 18px;
          align-items: center;
        }
        .split-summary-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 14px;
          align-items: stretch;
        }
        .summary-actions-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        @media (max-width: 900px) {
          .price-summary-chart {
            grid-template-columns: 1fr;
          }
          .summary-actions-row {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

      <Header orgName="AnaCare" theme={theme} onToggleTheme={onToggleTheme} />

      <div className="top-search-shell">
        <div className="top-search-inner">
          <div className="top-search-bar">
            <div
              className="top-search-cell"
              ref={procedureRef}
              style={{ position: 'relative' }}
              onClick={() => {
                setProcedureModalOpen(true)
                setProcedureCategory(null)
                setSearchProcedureInput('')
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span style={{ color: 'var(--text)', width: '100%', fontSize: 15 }}>
                {selectedProcedure?.name || 'Search for care'}
              </span>
            </div>
            <div
              className="top-search-cell"
              ref={locationRef}
              style={{
                position: 'relative',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 6,
                paddingTop: 6,
                paddingBottom: 6,
                cursor: 'default',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', cursor: 'text' }}
                onClick={() => zipInputRef.current?.focus()}
                role="presentation"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <input
                  ref={zipInputRef}
                  className="top-search-input"
                  value={searchZipInput}
                  onFocus={() => {}}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 5)
                    setSearchZipInput(raw)
                    if (raw.length < 5) {
                      setZipValidation({ status: 'idle', message: '', city: '', stateAbbr: '' })
                      setSearchLocation(prev => ({ ...prev, lat: null, lng: null, zip: raw, city: '', state: '' }))
                      return
                    }
                    geocodeZip(raw)
                  }}
                  placeholder="ZIP or use current location"
                  aria-label="Location ZIP code"
                />
                {searchZipInput.length === 5 && zipValidation.status === 'valid' && (
                  <span style={{ fontSize: 12, color: 'var(--green)', whiteSpace: 'nowrap' }}>
                    {zipValidation.city}{zipValidation.stateAbbr ? `, ${zipValidation.stateAbbr}` : ''}
                  </span>
                )}
                {searchZipInput.length === 5 && zipValidation.status === 'loading' && (
                  <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Validating...</span>
                )}
                {searchZipInput.length === 5 && zipValidation.status === 'invalid' && (
                  <span style={{ fontSize: 12, color: 'var(--red)', whiteSpace: 'nowrap' }}>Invalid ZIP</span>
                )}
              </div>
              <button
                type="button"
                disabled={geoLoading}
                onClick={(e) => {
                  e.stopPropagation()
                  useCurrentLocation()
                }}
                style={{
                  alignSelf: 'flex-start',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: geoLoading ? 'wait' : 'pointer',
                  padding: '2px 0',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                {geoLoading ? 'Getting location…' : 'Use current location'}
              </button>
            </div>
            <div
              className="top-search-cell"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setInsuranceEditOnOpen(false)
                setInsuranceOpen(true)
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              <span style={{ color: 'var(--text)', width: '100%', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedInsurance?.plan?.payer || selectedInsurance?.plan?.plan_name || (isCashPay ? 'Cash pay' : 'Select insurance')}
              </span>
            </div>
            <button type="button" className="top-compare-btn" onClick={handleCompareSearch} disabled={!canCompareSearch}>
              Compare prices
            </button>
          </div>
        </div>
      </div>

      <div className="top-filter-shell">
        <div className="top-filter-inner">
          <div className="top-filter-row">
            <button type="button" className="filter-trigger" onClick={() => setFiltersModalOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
              </svg>
              Filter results
            </button>
            <div style={{ position: 'relative' }} ref={distanceRef}>
              <button
                type="button"
                className="filter-pill"
                onClick={() => {
                  setDistanceOpen(v => !v)
                  setQualityOpen(false)
                  setPriceOpen(false)
                }}
              >
                <span>
                  {distanceFilter != null
                    ? DISTANCE_FILTER_PRESETS.find((p) => p.value === distanceFilter)?.label || `Within ${distanceFilter} miles`
                    : `All distances · search ${radiusMiles >= 250 ? '250+' : radiusMiles} mi`}
                </span>
                <span>⌄</span>
              </button>
              {distanceOpen && (
                <div className="filter-popover">
                  {DISTANCE_FILTER_PRESETS.map((p) => (
                    <button
                      key={String(p.value)}
                      type="button"
                      onClick={() => setDistanceFilterDraft(p.value)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
                        padding: '8px 8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)',
                      }}
                    >
                      {p.label} {distanceFilterDraft === p.value ? '•' : ''}
                    </button>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => setDistanceFilterDraft(null)}
                      style={{ flex: 1, border: '1px solid var(--border)', background: 'transparent', borderRadius: 8, padding: '8px', fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDistanceFilter(distanceFilterDraft)
                        setVisibleCount(20)
                        setDistanceOpen(false)
                      }}
                      style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: 8, padding: '8px', fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} ref={qualityRef}>
              <button
                type="button"
                className="filter-pill"
                onClick={() => {
                  setQualityOpen(v => !v)
                  setDistanceOpen(false)
                  setPriceOpen(false)
                }}
              >
                <span>{qualityFilter ? `${qualityFilter}+` : 'Any quality score'}</span>
                <span>⌄</span>
              </button>
              {qualityOpen && (
                <div className="filter-popover">
                  <button
                    type="button"
                    onClick={() => setCmsRatingHelpOpen(true)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: 'transparent',
                      padding: '8px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      color: 'var(--accent)',
                      fontWeight: 600,
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                    }}
                  >
                    ? What is quality score?
                  </button>
                  <button
                    type="button"
                    onClick={() => setQualityFilterDraft(null)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Any quality score {qualityFilterDraft == null ? '•' : ''}
                  </button>
                  {QUALITY_OPTIONS.map((q) => (
                    <button
                      key={q.value}
                      type="button"
                      onClick={() => setQualityFilterDraft(q.value)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      ★ {q.label} {qualityFilterDraft === q.value ? '•' : ''}
                    </button>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => setQualityFilterDraft(null)}
                      style={{ flex: 1, border: '1px solid var(--border)', background: 'transparent', borderRadius: 8, padding: '8px', fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQualityFilter(qualityFilterDraft)
                        setIncludeUnrated(qualityFilterDraft == null)
                        setVisibleCount(20)
                        setQualityOpen(false)
                      }}
                      style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: 8, padding: '8px', fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} ref={priceRef}>
              <button type="button" className="filter-pill" onClick={() => { setPriceOpen(v => !v); setDistanceOpen(false); setQualityOpen(false) }}>
                <span>{priceMin || priceMax ? 'Custom Price' : 'Any Price'}</span>
                <span>⌄</span>
              </button>
              {priceOpen && (
                <div className="filter-popover" style={{ minWidth: 300 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: 10, top: 8, color: 'var(--text-2)' }}>$</span>
                      <input
                        type="number"
                        value={priceMin}
                        onChange={(e) => setPriceMin(e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px 8px 24px', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: 10, top: 8, color: 'var(--text-2)' }}>$</span>
                      <input
                        type="number"
                        value={priceMax}
                        onChange={(e) => setPriceMax(e.target.value)}
                        placeholder="99999"
                        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px 8px 24px', fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => { setPriceMin(''); setPriceMax('') }}
                      style={{ flex: 1, border: '1px solid var(--border)', background: 'transparent', borderRadius: 8, padding: '8px', fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceOpen(false)}
                      style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: 8, padding: '8px', fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="results-container" style={{
        maxWidth: 1200, margin: '0 auto', padding: '24px 32px 48px',
      }}>
        {/* Back + Summary */}
        <div style={{ marginBottom: 20 }}>
          <button type="button" onClick={() => navigate('/home', { state: backPrefillState })} style={{
            background: 'none', border: 'none', color: 'var(--accent)',
            fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
            fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4,
            marginBottom: 12,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to search
          </button>
        </div>

        {(descText || sorted.length > 0) && (
          <>
            {!isCashPay && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <div style={{
                  display: 'inline-flex',
                  gap: 6,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 4,
                }}>
                  {[
                    { id: 'negotiated', label: 'Negotiated Rate' },
                    { id: 'oop', label: 'Estimated OOP' },
                  ].map((lens) => (
                    <button
                      key={lens.id}
                      type="button"
                      onClick={() => setMidpointLens(lens.id)}
                      style={{
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 8,
                        padding: '8px 12px',
                        background: chartLens === lens.id ? 'var(--accent)' : 'transparent',
                        color: chartLens === lens.id ? 'var(--accent-text)' : 'var(--text-2)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lens.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          <div className="split-summary-row">
            <div style={{
              padding: '16px 18px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-3)', marginBottom: 10 }}>
                Procedure Overview
              </div>
              <h2 style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 8, color: 'var(--text)' }}>{activeProcedureName}</h2>
              {fullOverviewText && (
                <>
                  <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.62, margin: 0 }}>
                    {showFullOverview ? fullOverviewText : truncatedOverviewText}
                  </p>
                  {fullOverviewText.length > truncatedOverviewText.length && (
                    <button
                      type="button"
                      onClick={() => setShowFullOverview(v => !v)}
                      style={{
                        marginTop: 10,
                        border: 'none',
                        background: 'none',
                        color: 'var(--accent)',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        fontFamily: 'inherit',
                      }}
                    >
                      {showFullOverview ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="price-summary-chart" style={{ marginBottom: 0 }}>
              <div style={{ textAlign: 'center', padding: '4px 6px' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    Midpoint {chartLens === 'negotiated' ? 'Negotiated Rate' : 'Estimated OOP'}
                  </div>
                  <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, color: 'var(--accent)' }}>
                    {fmt(chartStats.midpoint)}
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>
                  {chartLens === 'negotiated' ? 'Negotiated rate' : 'Estimated out-of-pocket'} midpoint benchmark for {activeProcedureName}.
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 18 }}>
                <div style={{ position: 'relative', height: 190 }}>
                  <svg width="100%" height="100%" viewBox="0 0 520 190" preserveAspectRatio="none">
                    {(() => {
                      if (!chartStats.bins.length) return null
                      const maxBin = Math.max(...chartStats.bins)
                      const baseY = 165
                      const points = chartStats.bins.map((b, i) => {
                        const x = (i / (chartStats.bins.length - 1)) * 520
                        const y = baseY - ((b / Math.max(1, maxBin)) * 120)
                        return `${x},${y}`
                      })
                      const areaPoints = `0,165 ${points.join(' ')} 520,165`
                      return (
                        <>
                          <polygon points={areaPoints} fill="rgba(61, 115, 72, 0.2)" />
                          <polyline points={points.join(' ')} fill="none" stroke="rgba(61, 115, 72, 0.88)" strokeWidth="2" />
                          <line
                            x1={(chartStats.markerPct / 100) * 520}
                            x2={(chartStats.markerPct / 100) * 520}
                            y1="18"
                            y2="165"
                            stroke="var(--text-2)"
                            strokeDasharray="6 6"
                            strokeWidth="1.5"
                          />
                        </>
                      )
                    })()}
                  </svg>
                  <div style={{
                    position: 'absolute',
                    left: `${chartStats.markerPct}%`,
                    top: 0,
                    transform: 'translate(-50%, 0)',
                    background: 'var(--accent)',
                    color: 'var(--accent-text)',
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: 14,
                    fontWeight: 700,
                  }}>
                    {fmt(chartStats.midpoint)}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -4 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    min.<br />
                    <strong style={{ color: 'var(--text)', fontSize: 18 }}>{fmt(chartStats.min)}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'right' }}>
                    max.<br />
                    <strong style={{ color: 'var(--text)', fontSize: 18 }}>{fmt(chartStats.max)}</strong>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="summary-actions-row">
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
            {!searchReady || loading
              ? 'Searching providers...'
              : `${searchedSorted.length} results for ${activeProcedureName}`}
          </p>
          <div style={{ minWidth: 240 }}>
            <input
              type="text"
              value={hospitalNameQuery}
              onChange={(e) => { setHospitalNameQuery(e.target.value); setVisibleCount(20) }}
              placeholder="Search hospital name..."
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>
          {/* Sort tabs */}
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'nowrap', justifyContent: 'center',
            background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', width: 'fit-content', overflowX: 'auto',
          }}>
            {SORT_TABS.map(tab => {
              const active = sortBy === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => { setSortBy(tab.value); setVisibleCount(20) }}
                  style={{
                    border: 'none', padding: '8px 16px', borderRadius: 'var(--radius)',
                    cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
                    fontFamily: 'inherit',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent-text)' : 'var(--text-2)',
                    transition: 'all 150ms ease',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>
            Search radius (updates results)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {RADIUS_STEPS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setRadiusMiles(m)
                  setVisibleCount(20)
                }}
                style={{
                  border: `1px solid ${radiusMiles === m ? 'var(--accent)' : 'var(--border)'}`,
                  background: radiusMiles === m ? 'var(--accent-soft)' : 'var(--surface)',
                  color: radiusMiles === m ? 'var(--accent)' : 'var(--text-2)',
                  borderRadius: 999,
                  padding: '6px 11px',
                  fontSize: 12,
                  fontWeight: radiusMiles === m ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {m === 250 ? '250+' : `${m}`}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {[
              { label: '≤50 mi', miles: 50 },
              { label: '51–250 mi', miles: 150 },
              { label: '250+ mi', miles: 250 },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => {
                  setRadiusMiles(b.miles)
                  setVisibleCount(20)
                }}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {!isCashPay && (
          <div style={{
            marginBottom: 14,
            fontSize: 13,
            color: 'var(--text-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div>
              OOP Max Remaining: <strong style={{ color: 'var(--text)' }}>{fmt(plan.oop_max_remaining)}</strong> · Deductible Remaining: <strong style={{ color: 'var(--text)' }}>{fmt(plan.deductible_remaining)}</strong>
            </div>
            <button
              type="button"
              onClick={() => {
                setInsuranceEditOnOpen(true)
                setInsuranceOpen(true)
              }}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                borderRadius: 10,
                padding: '7px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              Edit deductible / OOP max
            </button>
          </div>
        )}
        {searchError && (
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>
            {searchError}
          </div>
        )}
        {sortBy === 'best_value' && (
          <div style={{
            marginBottom: 18,
            padding: '12px 14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface)',
            display: 'grid',
            gap: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Prioritize lower price</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Prioritize higher quality</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(valueWeight * 100)}
              onChange={(e) => setValueWeight(Number(e.target.value) / 100)}
              aria-label="Best value tradeoff"
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
              Weight: {Math.round((1 - valueWeight) * 100)}% price / {Math.round(valueWeight * 100)}% quality
            </div>
            <div style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--border)',
            }}>
              <RadiusSlider
                id="best-value-radius"
                value={radiusMiles}
                onChange={setRadiusMiles}
                showBandQuickPicks
              />
            </div>
          </div>
        )}

        <div
          className="results-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
            alignItems: 'start',
            gap: 14,
          }}
        >
          <div>
            {/* Results */}
            <div className="results-grid" style={{
              display: 'grid', gridTemplateColumns: '1fr', gap: 14,
            }}>
              {searchedSorted.slice(0, visibleCount).map((h) => {
            const cost = cardCost(h, isCashPay, effectiveLens)
            const comp = priceComparison(cost, stats.midpoint)
            const stars = h.cms_stars ?? 0
            const verification = verificationMeta(h)
            const key = h.id || h.ccn
            return (
              <div
                key={key}
                ref={(el) => { hospitalCardRefs.current[key] = el }}
                className="result-card"
                onClick={() => { setSelectedHospital(h); setActiveHospitalId(key) }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedHospital(h)
                    setActiveHospitalId(key)
                  }
                }}
                style={activeHospitalId === key ? { borderColor: 'var(--accent)', boxShadow: 'var(--shadow-md)' } : undefined}
              >
                <div className="result-card-main">
                  <div style={{ minWidth: 0 }}>
                    <h3 className="result-card-name">
                      {h.name}
                    </h3>
                    <div className="result-card-meta">
                      {h.city}, {h.state}
                      {h.distance != null && <span> &middot; {h.distance} miles</span>}
                    </div>
                    <div className="result-card-badges">
                      <span className="result-chip" style={{ color: stars > 0 ? '#f59e0b' : 'var(--text-3)' }}>
                        {stars > 0 ? starDisplay(stars) : 'No rating'}
                      </span>
                      {(h.priceTier || h.price_position_tier) && (
                        <span className="result-chip" style={{ color: tierColor(h.priceTier || h.price_position_tier) }}>
                          {tierLabel(h.priceTier || h.price_position_tier)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="result-card-price">
                    <div className="result-card-price-label">{NEGOTIATED_LABEL}</div>
                    <div className="result-card-price-value">{fmt(negotiatedCost(h))}</div>
                    {!isCashPay && (
                      <div className="result-card-oop">
                        {OOP_LABEL}: {fmt(oopCost(h) ?? negotiatedCost(h))}
                      </div>
                    )}
                  </div>
                </div>

                {(() => {
                  const tier = h.priceTier || h.price_position_tier || (comp.label === 'Significantly lower'
                    ? 'significantly_lower'
                    : comp.label === 'Slightly lower'
                      ? 'slightly_lower'
                      : comp.label === 'Significantly higher'
                        ? 'significantly_higher'
                        : comp.label === 'Slightly higher'
                          ? 'slightly_higher'
                          : 'near_midpoint')
                  return (
                    <div className="result-card-footer">
                      <div className="result-evidence">
                        <span>{verification.label}</span>
                        <span>&middot;</span>
                        <a href={verification.docsUrl} target="_blank" rel="noopener noreferrer">
                          Source policy
                        </a>
                        <span>&middot;</span>
                        <a href={providerWebsite(h)} target="_blank" rel="noopener noreferrer">
                          Provider website
                        </a>
                      </div>
                      {tier && (
                        <span className="result-tier" style={{ color: tierColor(tier) }}>
                          {tierLabel(tier)} {tier.includes('lower') ? '↘' : tier.includes('higher') ? '↗' : ''}
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
              })}
            </div>
          </div>

          <div className="results-map-col" style={{ position: 'sticky', top: 84 }}>
            <ResultsMap
              hospitals={searchedSorted}
              center={{ lat: searchLocation.lat, lng: searchLocation.lng }}
              getCost={getMapCost}
              onHospitalPreview={handleHospitalSelectFromMap}
            />
          </div>
        </div>

        {searchedSorted.length > visibleCount && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <button
              type="button"
              onClick={() => setVisibleCount(c => c + 20)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '10px 24px',
                fontSize: 14, color: 'var(--accent)', cursor: 'pointer',
                fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              Show more ({searchedSorted.length - visibleCount} remaining)
            </button>
          </div>
        )}

        {searchedSorted.length === 0 && searchReady && !loading && !searchError && (
          <div
            role="status"
            style={{
              textAlign: 'center',
              padding: 40,
              color: 'var(--text-2)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: 520,
              margin: '0 auto',
            }}
          >
            {dataSource == null && activeProcedureId ? (
              <>
                <p style={{ fontSize: 16, marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>
                  Add a location to load hospital prices
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
                  Enter a valid 5-digit ZIP in the bar above (we&apos;ll verify it), or use{' '}
                  <strong>Use current location</strong>. Then results will appear here automatically.
                </p>
              </>
            ) : dataSource === 'api' && baseList.length === 0 ? (
              <>
                <p style={{ fontSize: 16, marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>
                  No hospitals found in this area
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.55 }}>
                  Try a larger search radius using the chips above, or pick a different ZIP.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 16, marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>
                  No providers match your filters or search
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.55 }}>
                  Try widening distance, lowering the quality filter, or clearing the hospital name search.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedHospital && (
        <>
          <div
            className="drawer-overlay open"
            role="presentation"
            onClick={() => { setSelectedHospital(null); setEpisodeDetail(null) }}
          />
          <aside className="drawer-panel open" aria-label="Provider cost details">
            <div style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                  Provider profile
                </h2>
                <button
                  type="button"
                  onClick={() => { setSelectedHospital(null); setEpisodeDetail(null) }}
                  style={{
                    border: 'none', background: 'var(--surface-2)', borderRadius: '50%',
                    width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: 'var(--text-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  x
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    padding: 14,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  <h3 style={{ fontSize: 34, lineHeight: 1.05, marginBottom: 6, color: 'var(--text)' }}>
                    {selectedHospital.name}
                  </h3>
                  <p style={{ fontSize: 13, color: '#f59e0b', marginTop: 2 }}>
                    {cmsNumeric} {cmsText}
                  </p>
                  <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                    <span>Overall CMS Rating</span>
                    <button
                      type="button"
                      onClick={() => setCmsRatingHelpOpen(true)}
                      aria-label="Explain CMS rating"
                      style={{
                        border: '1px solid var(--border-hover)',
                        background: 'var(--surface-2)',
                        color: 'var(--text-2)',
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        fontSize: 11,
                        lineHeight: '14px',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      ?
                    </button>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8, marginBottom: 8 }}>
                    {selectedHospital.city}, {selectedHospital.state}
                    {selectedHospital.distance != null && ` \u00B7 ${selectedHospital.distance} miles`}
                  </p>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a
                      href={getDirectionsUrl(selectedHospital)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      Get Directions
                    </a>
                    <span style={{ color: 'var(--text-3)' }}>·</span>
                    <a
                      href={getMapSearchUrl(selectedHospital)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      Open hospital in Google Maps
                    </a>
                  </div>
                </div>

                <div
                  style={{
                    padding: 14,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Estimated total at this provider
                  </div>
                  <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--accent)', marginTop: 4, lineHeight: 1 }}>
                    {fmt(cardCost(selectedHospital, isCashPay, effectiveLens))}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                    {isCashPay
                      ? 'Total estimated amount without insurance'
                      : 'Total estimated out-of-pocket with your current plan inputs'}
                  </div>
                  {!isCashPay && (
                    <div
                      style={{
                        marginTop: 10,
                        borderTop: '1px solid var(--border)',
                        paddingTop: 10,
                        fontSize: 13,
                        color: 'var(--text-2)',
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ color: 'var(--text)' }}>
                        {activePlan?.payer || 'Insurance'} {activePlan?.network_type ? `(${activePlan.network_type})` : ''}
                      </div>
                      <div>
                        {`Copay ${fmt(plan.pc_copay)} · Deductible left ${fmt(plan.deductible_remaining)} · OOP max left ${fmt(plan.oop_max_remaining)}`}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => window.open(providerWebsite(selectedHospital), '_blank', 'noopener,noreferrer')}
                    style={{
                      marginTop: 12,
                      width: '100%',
                      border: '1px solid var(--accent)',
                      background: 'var(--accent)',
                      color: 'var(--accent-text)',
                      borderRadius: 'var(--radius)',
                      padding: '10px 12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Straight to website
                  </button>
                </div>
              </div>

              {/* Price comparison */}
              <div style={{
                padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)', marginBottom: 22,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                  How this provider stacks up (same CPT {NEGOTIATED_LABEL.toLowerCase()}s)
                </div>
                <div style={{ position: 'relative', width: '100%', height: 190 }}>
                  <svg width="100%" height="100%" viewBox="0 0 640 210" preserveAspectRatio="xMidYMid meet">
                    <path d="M 140 170 A 180 180 0 0 1 500 170" fill="none" stroke="var(--surface-3)" strokeWidth="10" strokeLinecap="round" />
                    <path
                      d="M 140 170 A 180 180 0 0 1 500 170"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.max(0, Math.min(1, stackRatio)) * 565.5} 565.5`}
                    />
                    <circle
                      cx={140 + 360 * stackRatio}
                      cy={170 - Math.sqrt(Math.max(0, (180 * 180) - ((140 + 360 * stackRatio) - 320) ** 2))}
                      r="9"
                      fill="var(--surface)"
                      stroke="var(--text-2)"
                      strokeWidth="2"
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: 78, left: 0, right: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: 56, lineHeight: 1, color: 'var(--accent)', fontWeight: 700 }}>
                      {fmt(cardCost(selectedHospital, isCashPay, effectiveLens))}
                    </div>
                    <div style={{ fontSize: 16, color: 'var(--text-2)' }}>This provider&apos;s rate</div>
                  </div>
                  <div style={{ position: 'absolute', left: 0, bottom: 30, fontSize: 14, color: 'var(--text-3)' }}>
                    Lowest<br /><strong style={{ color: 'var(--text)' }}>{fmt(stats.min)}</strong>
                  </div>
                  <div style={{ position: 'absolute', right: 0, bottom: 30, fontSize: 14, color: 'var(--text-3)', textAlign: 'right' }}>
                    Highest<br /><strong style={{ color: 'var(--text)' }}>{fmt(stats.max)}</strong>
                  </div>
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', fontSize: 15, color: 'var(--text-2)' }}>
                    Midpoint benchmark: <strong style={{ color: 'var(--text)' }}>{fmt(stats.midpoint)}</strong>
                  </div>
                </div>
              </div>

              {/* Comprehensive pricing model */}
              <div style={{
                padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)', marginBottom: 22,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>How you are billed</h3>
                  <button
                    type="button"
                    onClick={() => setBillingHelpOpen(true)}
                    aria-label="Explain billing methodology"
                    style={{
                      border: '1px solid var(--border-hover)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-2)',
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      fontSize: 11,
                      lineHeight: '16px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ?
                  </button>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
                  Comprehensive pricing model: negotiated CPT package baseline + itemized episode services + plan cost-sharing math (deductible, then coinsurance), capped by remaining OOP max.
                </p>
                {!isCashPay && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, background: 'var(--surface-2)', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                      Exact out-of-pocket calculation
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                      {NEGOTIATED_LABEL}: <strong style={{ color: 'var(--text)' }}>{fmt(negotiatedCost(selectedHospital))}</strong><br />
                      Deductible applied first: <strong style={{ color: 'var(--text)' }}>{fmt(plan.deductible_remaining)}</strong><br />
                      Plan copay per visit: <strong style={{ color: 'var(--text)' }}>{fmt(plan.pc_copay)}</strong><br />
                      Coinsurance on remaining eligible charges: <strong style={{ color: 'var(--text)' }}>{Math.round((plan.coinsurance_pct || 0) * 100)}%</strong><br />
                      OOP max cap remaining: <strong style={{ color: 'var(--text)' }}>{fmt(plan.oop_max_remaining)}</strong><br />
                      Final estimated patient responsibility: <strong style={{ color: 'var(--accent)' }}>{fmt(cardCost(selectedHospital, isCashPay, effectiveLens))}</strong>
                    </div>
                  </div>
                )}

                {packageRows.length > 0 && (
                  <div style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 14 }}>
                    <table className="pkg-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr><th>Code</th><th>Type</th><th>Description</th><th>Estimated price</th></tr>
                      </thead>
                      <tbody>
                        {modeledPackagePrices.slice(0, 16).map((row, idx) => (
                          <tr key={`${idx}-${row.code}-${row.code_type}`}>
                            <td style={{ color: 'var(--accent)', fontWeight: 500 }}>{row.code}</td>
                            <td style={{ color: 'var(--text-2)' }}>{row.code_type}</td>
                            <td style={{ color: 'var(--text)' }}>{row.description}</td>
                            <td style={{ color: 'var(--text)', textAlign: 'right', fontWeight: 600 }}>{fmt(row.modeled_price || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              {episodeDetail?.episode && !isCashPay ? (
                <div style={{
                  borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                  overflow: 'hidden', marginBottom: 16,
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-2)' }}>Phase</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-2)' }}>Your cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Pre-operative', episodeDetail.episode.preop_oop],
                        ['Surgery & facility', episodeDetail.episode.surgery_oop],
                        ['Post-operative', episodeDetail.episode.postop_oop],
                      ].map(([label, val]) => (
                        <tr key={label} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 16px', color: 'var(--text)' }}>{label}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>{fmt(val)}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-2)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>Episode total (est.)</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                          {fmt(episodeDetail.episode.total_episode_oop)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{
                  borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                  overflow: 'hidden', marginBottom: 16,
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-2)' }}>Component</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-2)' }}>Estimated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'Facility fee', gross: (selectedHospital.price?.negotiated || selectedHospital.negotiated_rate || 0) * 0.55 },
                        { name: 'Professional fee', gross: (selectedHospital.price?.negotiated || selectedHospital.negotiated_rate || 0) * 0.30 },
                        { name: 'Anesthesia', gross: (selectedHospital.price?.negotiated || selectedHospital.negotiated_rate || 0) * 0.054 },
                      ].map((r) => (
                        <tr key={r.name} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 16px', color: 'var(--text)' }}>{r.name}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-2)' }}>{fmt(r.gross)}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-2)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>Total</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                          {fmt(selectedHospital.price?.negotiated || selectedHospital.negotiated_rate || cardCost(selectedHospital, isCashPay, effectiveLens))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {episodeDetail?.episode && !isCashPay && (
                <details
                  style={{
                    marginBottom: 18,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface-2)',
                    padding: '10px 12px',
                  }}
                >
                  <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    View your OOP exact calculations
                  </summary>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                    <div>Deductible remaining: <strong style={{ color: 'var(--text)' }}>{fmt(plan.deductible_remaining)}</strong></div>
                    <div>Copay per visit: <strong style={{ color: 'var(--text)' }}>{fmt(plan.pc_copay)}</strong></div>
                    <div>Coinsurance: <strong style={{ color: 'var(--text)' }}>{Math.round((plan.coinsurance_pct || 0) * 100)}%</strong></div>
                    <div>OOP max remaining: <strong style={{ color: 'var(--text)' }}>{fmt(plan.oop_max_remaining)}</strong></div>
                  </div>
                  <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface)' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-2)' }}>Line item</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-2)' }}>Gross</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-2)' }}>Your cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...(episodeDetail.episode.preop_items || []), ...(episodeDetail.episode.surgery_items || []), ...(episodeDetail.episode.postop_items || [])].map((row, idx) => (
                          <tr key={`calc-${idx}-${row.name}`} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px', color: 'var(--text)' }}>{row.name}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-2)' }}>{fmt(row.gross_cost)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{fmt(row.your_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
              </div>

              {/* Your right to shop */}
              {nsaTimeline.length > 0 && (
                <>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                    Your Right to Shop
                  </h3>
                  <div style={{
                    padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)', marginBottom: 22,
                  }}>
                    {nsaTimeline.map((step) => (
                      <div key={step.step} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                        <div style={{
                          flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                          color: 'var(--accent)', fontSize: 13, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{step.step}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{step.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>{step.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Other providers */}
              {otherProviders.length > 0 && (
                <>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                    See other estimates near you
                  </h3>
                  <ul style={{ listStyle: 'none', marginBottom: 22, padding: 0 }}>
                    {otherProviders.map((p) => (
                      <li key={p.ccn || p.id} style={{ marginBottom: 10 }}>
                        <button
                          type="button"
                          onClick={() => setSelectedHospital(p)}
                          style={{
                            width: '100%', textAlign: 'left',
                            background: 'var(--surface-2)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)', padding: '12px 14px',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{p.city}, {p.state}{p.distance != null ? ` \u00B7 ${p.distance} mi` : ''}</span>
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                              {fmt(negotiatedCost(p))}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Disclaimer */}
              <div style={{
                padding: '14px 16px', background: 'var(--surface-2)',
                borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5,
              }}>
                Use this information to compare providers and estimate what you may pay.
                Verify these details directly with your provider before scheduling care.
                Estimates use machine-readable rates where available and episode models for pre- and post-op phases.
                Final amounts depend on your clinical course, coding, and benefits.
              </div>
            </div>
          </aside>
        </>
      )}

      {cmsRatingHelpOpen && (
        <>
          <div className="filter-modal-overlay" role="presentation" onClick={() => setCmsRatingHelpOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="CMS rating methodology"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(860px, calc(100vw - 24px))',
              maxHeight: '88vh',
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              boxShadow: 'var(--shadow-lg)',
              zIndex: 940,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 28, color: 'var(--text)', lineHeight: 1.1 }}>
                Quality Score
              </h3>
              <button type="button" onClick={() => setCmsRatingHelpOpen(false)} style={{ border: 'none', background: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 28 }}>
                ×
              </button>
            </div>
            <div style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
              <h4 style={{ color: 'var(--text)', fontSize: 20, marginBottom: 8 }}>What is CMS and what do the star ratings mean?</h4>
              <p style={{ marginBottom: 14 }}>
                <strong style={{ color: 'var(--text)' }}>CMS (Centers for Medicare &amp; Medicaid Services)</strong> is the federal agency
                within the U.S. Department of Health &amp; Human Services that administers Medicare, Medicaid, the Children's Health Insurance
                Program (CHIP), and the Health Insurance Marketplace. CMS publishes hospital quality data to help patients make
                informed healthcare decisions.
              </p>
              <p style={{ marginBottom: 14 }}>
                The <strong style={{ color: 'var(--text)' }}>Overall Hospital Quality Star Rating</strong> is a summary measure
                that combines multiple quality metrics into a single 1-to-5 star score. These metrics include:
              </p>
              <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
                {[
                  { title: 'Mortality', desc: 'How often patients die within 30 days of admission for certain conditions.' },
                  { title: 'Safety of Care', desc: 'How often patients experience complications or infections during their hospital stay.' },
                  { title: 'Readmission', desc: 'How often patients are readmitted to the hospital within 30 days of discharge.' },
                  { title: 'Patient Experience', desc: 'Survey-based scores from patients about their care experience (HCAHPS).' },
                  { title: 'Timely & Effective Care', desc: 'Whether the hospital provides recommended treatments in a timely manner.' },
                ].map((m) => (
                  <div key={m.title} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface-2)' }}>
                    <strong style={{ color: 'var(--text)', fontSize: 13 }}>{m.title}</strong>
                    <div style={{ fontSize: 12, marginTop: 2 }}>{m.desc}</div>
                  </div>
                ))}
              </div>
              <p style={{ marginBottom: 14 }}>
                These scores come directly from CMS hospital quality publications and are not edited or influenced by
                providers or AnaCare. A higher star rating generally indicates better outcomes and patient experience.
              </p>
              <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface-2)' }}>
                <strong style={{ color: 'var(--text)' }}>Missing Rating</strong>
                <div style={{ fontSize: 12, marginTop: 2 }}>Some facilities (like many Ambulatory Surgery Centers and specialized sites) do not
                receive CMS star ratings due to limited data or different reporting requirements.</div>
              </div>
            </div>
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button
                type="button"
                onClick={() => setCmsRatingHelpOpen(false)}
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 'var(--radius)', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {selectedHospital && billingHelpOpen && (
        <>
          <div className="filter-modal-overlay" role="presentation" onClick={() => setBillingHelpOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Billing methodology"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(980px, calc(100vw - 24px))',
              maxHeight: '88vh',
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              boxShadow: 'var(--shadow-lg)',
              zIndex: 940,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 26, color: 'var(--text)' }}>How You Are Billed: Methodology</h3>
              <button type="button" onClick={() => setBillingHelpOpen(false)} style={{ border: 'none', background: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 28 }}>
                ×
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
              <p>
                We model the episode using this hospital&apos;s negotiated package rate as the baseline for the selected CPT.
                {(apiMeta?.uses_operating_room_charges ?? episodeDetail?.uses_operating_room_charges ?? true)
                  ? ' Surgical-style episodes split into facility, professional (surgeon), and anesthesia shares, then combine with expected pre-op and post-op items.'
                  : ' This outpatient-style episode uses facility & technical and professional (physician) shares only—no separate operating-room, recovery, or anesthesia line items—plus any pre- and post-service items in the pathway.'}
              </p>
              <p>
                Patient responsibility is then computed in sequence: deductible is consumed first, then coinsurance is applied to remaining eligible charges,
                and total patient spend is capped by remaining out-of-pocket maximum.
              </p>
              <p>
                Credibility: price inputs are sourced from machine-readable contracted rates and hospital mappings in our backend; the OOP math is deterministic
                and reproducible from the exact inputs shown below.
              </p>
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, background: 'var(--surface-2)' }}>
                <strong style={{ color: 'var(--text)' }}>Inputs used in this estimate</strong>
                <div>{NEGOTIATED_LABEL}: <strong style={{ color: 'var(--text)' }}>{fmt(negotiatedCost(selectedHospital))}</strong></div>
                <div>Deductible remaining: <strong style={{ color: 'var(--text)' }}>{fmt(plan.deductible_remaining)}</strong></div>
                <div>Copay per visit: <strong style={{ color: 'var(--text)' }}>{fmt(plan.pc_copay)}</strong></div>
                <div>Coinsurance: <strong style={{ color: 'var(--text)' }}>{Math.round((plan.coinsurance_pct || 0) * 100)}%</strong></div>
                <div>OOP max remaining: <strong style={{ color: 'var(--text)' }}>{fmt(plan.oop_max_remaining)}</strong></div>
                <div>Estimated patient total: <strong style={{ color: 'var(--accent)' }}>{fmt(cardCost(selectedHospital, isCashPay, effectiveLens))}</strong></div>
              </div>
            </div>
          </div>
        </>
      )}

      {mapPreviewHospital && (
        <>
          <div
            className="filter-modal-overlay"
            role="presentation"
            onClick={() => setMapPreviewHospital(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Hospital overview"
            style={{
              position: 'fixed',
              right: 18,
              top: 18,
              width: 'min(420px, calc(100vw - 36px))',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-lg)',
              zIndex: 930,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <a
                href="#"
                onClick={(evt) => {
                  evt.preventDefault()
                  setSelectedHospital(mapPreviewHospital)
                  setMapPreviewHospital(null)
                }}
                style={{
                  display: 'block',
                  flex: 1,
                  minWidth: 0,
                  color: 'inherit',
                  textDecoration: 'none',
                }}
                aria-label={`View full details for ${mapPreviewHospital.name}`}
              >
                <h3 style={{ fontSize: 22, lineHeight: 1, color: 'var(--accent)', marginBottom: 8 }}>
                  {fmt(cardCost(mapPreviewHospital, isCashPay, effectiveLens))}
                </h3>
                <div
                  style={{
                    fontSize: 18,
                    lineHeight: 1.25,
                    fontWeight: 650,
                    color: 'var(--text)',
                    marginBottom: 6,
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  {mapPreviewHospital.name}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--text-2)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  {mapPreviewHospital.city}, {mapPreviewHospital.state}
                  {mapPreviewHospital.distance != null ? ` · ${mapPreviewHospital.distance} miles` : ''}
                </div>
              </a>
              <button
                type="button"
                onClick={() => setMapPreviewHospital(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-3)',
                  fontSize: 24,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: 0,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        </>
      )}

      {filtersModalOpen && (
        <>
          <div className="filter-modal-overlay" role="presentation" onClick={() => setFiltersModalOpen(false)} />
          <aside className="filter-modal" aria-label="Filter Results">
            <div className="filter-modal-header">
              <h2 style={{ fontSize: 42, lineHeight: 1, fontWeight: 700, color: 'var(--accent)' }}>Filter Results</h2>
              <button
                type="button"
                onClick={() => setFiltersModalOpen(false)}
                style={{ border: 'none', background: 'none', color: 'var(--accent)', fontSize: 42, cursor: 'pointer', lineHeight: 1 }}
                aria-label="Close filters"
              >
                ×
              </button>
            </div>

            <div className="filter-modal-section">
              <div style={{ fontSize: 20, lineHeight: 1, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Distance</div>
              {DISTANCE_FILTER_PRESETS.map((p) => (
                <label key={String(p.value)} className="filter-option">
                  <input
                    type="radio"
                    name="distance-filter"
                    checked={distanceFilter === p.value}
                    onChange={() => setDistanceFilter(p.value)}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>

            <div className="filter-modal-section">
              <div style={{ fontSize: 20, lineHeight: 1, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Care Quality</div>
              {QUALITY_OPTIONS.map((quality) => (
                <label key={quality.value} className="filter-option">
                  <input
                    type="radio"
                    name="quality-filter"
                    checked={qualityFilter === quality.value}
                    onChange={() => setQualityFilter(quality.value)}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>★ {quality.label}</span>
                </label>
              ))}
              <label className="filter-option" style={{ marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={includeUnrated}
                  onChange={(e) => setIncludeUnrated(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span>Include unrated providers</span>
              </label>
            </div>

            <div className="filter-modal-section">
              <div style={{ fontSize: 20, lineHeight: 1, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Price Range</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 15, color: 'var(--text-3)' }}>$</span>
                    <input
                      type="number"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder="0"
                      style={{
                        width: '100%', height: 52, borderRadius: 10, border: '1px solid var(--border)',
                        background: 'var(--surface)', color: 'var(--text)', padding: '0 12px 0 30px', fontSize: 16, fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)' }}>Minimum</div>
                </div>
                <div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 15, color: 'var(--text-3)' }}>$</span>
                    <input
                      type="number"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder="99999"
                      style={{
                        width: '100%', height: 52, borderRadius: 10, border: '1px solid var(--border)',
                        background: 'var(--surface)', color: 'var(--text)', padding: '0 12px 0 30px', fontSize: 16, fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)' }}>Maximum</div>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setPriceMin(''); setPriceMax('') }}
                  style={{ border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersModalOpen(false)}
                  style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--accent)', borderRadius: 10, padding: '8px 16px', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Apply
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
      {insuranceOpen && (
        <>
          <div
            className="filter-modal-overlay"
            role="presentation"
            onMouseDown={(evt) => {
              evt.preventDefault()
              evt.stopPropagation()
              setInsuranceOpen(false)
              setInsuranceEditOnOpen(false)
            }}
            onClick={(evt) => {
              evt.preventDefault()
              evt.stopPropagation()
              setInsuranceOpen(false)
              setInsuranceEditOnOpen(false)
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Select insurance"
            onMouseDown={(evt) => evt.stopPropagation()}
            onClick={(evt) => evt.stopPropagation()}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(860px, calc(100vw - 24px))',
              maxHeight: '88vh',
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-lg)',
              zIndex: 925,
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 20, color: 'var(--text)' }}>Select insurance</h3>
              <button
                type="button"
                onMouseDown={(evt) => {
                  evt.preventDefault()
                  evt.stopPropagation()
                  setInsuranceOpen(false)
                  setInsuranceEditOnOpen(false)
                }}
                onClick={(evt) => {
                  evt.preventDefault()
                  evt.stopPropagation()
                  setInsuranceOpen(false)
                  setInsuranceEditOnOpen(false)
                }}
                style={{ border: 'none', background: 'var(--surface-2)', borderRadius: 999, width: 32, height: 32, cursor: 'pointer' }}
              >
                x
              </button>
            </div>
            <PlanSelector
              directOpen
              openBenefitsOnMount={insuranceEditOnOpen}
              initialSelection={selectedInsurance || searchState.plan || null}
              onChange={(next) => {
                if (!next?.plan_id && !next?.isCashPay) return
                setSelectedInsurance((prev) => (sameInsurance(prev, next) ? prev : next))
                // Do not close here — PlanSelector syncs onChange on every field change; closing
                // would dismiss the modal immediately. User closes with Done or overlay.
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setInsuranceOpen(false)
                  setInsuranceEditOnOpen(false)
                }}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
      {procedureModalOpen && (
        <>
          <div className="filter-modal-overlay" role="presentation" onClick={() => setProcedureModalOpen(false)} />
          <div className="search-modal" role="dialog" aria-modal="true" aria-label="Search for care">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <input
                ref={procedureInputRef}
                className="top-search-input"
                value={searchProcedureInput}
                onChange={(e) => {
                  setSearchProcedureInput(e.target.value)
                  setProcedureCategory(null)
                }}
                placeholder="Search for care..."
                aria-label="Search for care"
                autoFocus
                style={{ fontSize: 16 }}
              />
              <button
                type="button"
                onClick={() => setProcedureModalOpen(false)}
                style={{ border: 'none', background: 'var(--surface-2)', width: 30, height: 30, borderRadius: 999, cursor: 'pointer', fontSize: 16, color: 'var(--text-2)' }}
              >
                x
              </button>
            </div>
            {searchProcedureInput.trim() ? (
              procedureOptions.length === 0 ? (
                <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-3)' }}>No procedures found.</div>
              ) : (
                procedureOptions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="top-search-dropdown-item"
                    style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', fontFamily: 'inherit' }}
                    onClick={() => {
                      setSearchProcedureInput(p.name)
                      setSelectedProcedure({ id: p.id, name: p.name })
                      setProcedureModalOpen(false)
                    }}
                  >
                    {p.name}
                  </button>
                ))
              )
            ) : procedureCategory ? (
              <>
                <button
                  type="button"
                  className="top-search-dropdown-item"
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 600 }}
                  onClick={() => setProcedureCategory(null)}
                >
                  ← Back to categories
                </button>
                {(PROC_CATEGORIES[procedureCategory] || []).map((id) => {
                  const proc = ALL_PROCEDURES.find(p => p.id === id)
                  if (!proc) return null
                  return (
                    <button
                      key={proc.id}
                      type="button"
                      className="top-search-dropdown-item"
                      style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', fontFamily: 'inherit' }}
                      onClick={() => {
                        setSearchProcedureInput(proc.name)
                        setSelectedProcedure({ id: proc.id, name: proc.name })
                        setProcedureModalOpen(false)
                      }}
                    >
                      {proc.name}
                    </button>
                  )
                })}
              </>
            ) : (
              <>
                <div className="dropdown-header">Browse by category</div>
                {CATEGORY_ORDER.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className="top-search-dropdown-item"
                    style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => setProcedureCategory(cat)}
                  >
                    <span>{cat}</span>
                    <span style={{ color: 'var(--text-3)' }}>{(PROC_CATEGORIES[cat] || []).length} ›</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* No-results modal */}
      {noResultsModalOpen && (
        <div
          className="no-results-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setNoResultsModalOpen(false) }}
        >
          <div className="no-results-modal" onClick={(e) => e.stopPropagation()}>
            <div className="no-results-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <line x1="9" y1="9" x2="15" y2="15" />
                <line x1="15" y1="9" x2="9" y2="15" />
              </svg>
            </div>
            <h3 style={{
              fontSize: 20, fontWeight: 700, color: 'var(--text)',
              margin: '0 0 8px', letterSpacing: '-0.01em',
            }}>
              No hospitals found in this area
            </h3>
            <p style={{
              fontSize: 14, color: 'var(--text-2)', margin: '0 0 24px',
              lineHeight: 1.5,
            }}>
              Try increasing your search radius to find providers nearby.
            </p>
            <div style={{ padding: '0 8px', marginBottom: 24 }}>
              <RadiusSlider
                id="modal-radius"
                value={modalRadius}
                onChange={setModalRadius}
                showBandQuickPicks
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setNoResultsModalOpen(false)}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-2)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '11px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 150ms ease',
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setRadiusMiles(modalRadius)
                  setNoResultsModalOpen(false)
                }}
                style={{
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'var(--accent-text)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '11px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 40%, transparent 60%)',
                  transition: 'all 150ms ease',
                }}
              >
                Search Again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
