import hospitals from './hospitals.json'
import basePrices from './basePrices.json'
import proceduresData from './procedures.json'

export { hospitals, basePrices, proceduresData }

const TIER_ADJ = { 1: 1.10, 2: 1.00, 3: 0.88 }

export function getPrice(hospital, procedureId) {
  const b = basePrices[procedureId]
  if (!b) return null
  const randAdj = (hospital.rand_multiplier || 1.80) / 1.80
  const tierAdj = TIER_ADJ[hospital.tier] || 1.0
  const m = randAdj * tierAdj
  return {
    gross: Math.round(b.gross * m),
    negotiated: Math.round(b.negotiated * m),
    cash: Math.round(b.cash * m),
    facility: b.facility,
    surgeon: b.surgeon,
    anesthesia: b.anesthesia,
    implant: b.implant,
  }
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function computeOOP(negotiatedRate, plan) {
  const coinsurance = plan.coinsurance_pct || 0.20
  let dedRemaining = plan.deductible_remaining ?? 0
  let oopConsumed = 0
  const oopMax = plan.oop_max_remaining ?? 99999

  function applyCost(grossCost) {
    if (oopConsumed >= oopMax) return 0

    const dedPortion = Math.min(grossCost, Math.max(0, dedRemaining))
    dedRemaining -= dedPortion

    const remainder = grossCost - dedPortion
    const coinsPortion = coinsurance * remainder

    let yourCost = dedPortion + coinsPortion
    yourCost = Math.min(yourCost, oopMax - oopConsumed)
    oopConsumed += yourCost
    return Math.round(yourCost * 100) / 100
  }

  const facilityRate = negotiatedRate * 0.55
  const surgeonRate = negotiatedRate * 0.30
  const anesthesiaRate = surgeonRate * 0.18

  const facilityOOP = applyCost(facilityRate)
  const surgeonOOP = applyCost(surgeonRate)
  const anesthesiaOOP = applyCost(anesthesiaRate)

  const totalOOP = facilityOOP + surgeonOOP + anesthesiaOOP

  return {
    totalOOP: Math.round(totalOOP),
    facilityOOP: Math.round(facilityOOP),
    surgeonOOP: Math.round(surgeonOOP),
    anesthesiaOOP: Math.round(anesthesiaOOP),
    grossTotal: Math.round(facilityRate + surgeonRate + anesthesiaRate),
    oopMaxHit: oopConsumed >= oopMax,
  }
}

export function findHospitals({ procedureId, lat, lng, radiusMiles, plan }) {
  if (!procedureId) return []

  const matching = hospitals.filter(h => h.procedures.includes(procedureId))

  let results = matching.map(h => {
    const dist = (lat != null && lng != null)
      ? haversine(lat, lng, h.lat, h.lng)
      : null
    const price = getPrice(h, procedureId)
    if (!price) return null

    const oop = plan
      ? computeOOP(price.negotiated, plan)
      : null

    return {
      ...h,
      distance: dist != null ? Math.round(dist * 10) / 10 : null,
      price,
      estimatedOOP: oop?.totalOOP ?? null,
      oopBreakdown: oop,
    }
  }).filter(Boolean)

  if (lat != null && lng != null && radiusMiles > 0) {
    results = results.filter(r => r.distance != null && r.distance <= radiusMiles)
  }

  results.sort((a, b) => (a.price.negotiated - b.price.negotiated))

  return results
}

export function getAllProcedures() {
  const { procedures, categories } = proceduresData
  return { procedures, categories }
}

export function searchProcedures(query) {
  if (!query || query.length < 1) return []
  const { procedures } = proceduresData
  const q = query.toLowerCase()
  return Object.values(procedures)
    .filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    .slice(0, 10)
}
