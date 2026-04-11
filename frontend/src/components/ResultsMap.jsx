import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

function formatCost(n) {
  return '$' + Math.round(Number(n || 0)).toLocaleString()
}

function compactCost(n) {
  const v = Math.round(Number(n || 0))
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}m`
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v}`
}

function tierColor(tier) {
  switch (tier) {
    case 'significantly_lower': return '#16a34a'
    case 'slightly_lower': return '#22c55e'
    case 'slightly_higher': return '#f59e0b'
    case 'significantly_higher': return '#ef4444'
    default: return '#2d4a3a'
  }
}

const MAP_STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL ||
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

export default function ResultsMap({
  hospitals,
  center,
  getCost,
  onHospitalPreview,
}) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const centerMarkerRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: MAP_STYLE_URL,
      center: [-98.35, 39.5],
      zoom: 2.6,
      pitch: 42,
      antialias: true,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')
    mapInstanceRef.current = map

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      centerMarkerRef.current?.remove()
      mapInstanceRef.current = null
      centerMarkerRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || center?.lat == null || center?.lng == null) return
    centerMarkerRef.current?.remove()
    centerMarkerRef.current = new maplibregl.Marker({
      color: '#3d7348',
      scale: 0.8,
    })
      .setLngLat([center.lng, center.lat])
      .addTo(map)

    if (!hospitals?.length) {
      map.flyTo({ center: [center.lng, center.lat], zoom: 7.5, pitch: 45, bearing: 0, duration: 850 })
      return
    }
    const bounds = new maplibregl.LngLatBounds()
    bounds.extend([center.lng, center.lat])
    hospitals.forEach((h) => {
      if (h.lng != null && h.lat != null) bounds.extend([h.lng, h.lat])
    })
    map.fitBounds(bounds, { padding: 40, maxZoom: 10.8, duration: 850, pitch: 45 })
  }, [center?.lat, center?.lng, hospitals])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const locationCounts = new Map()
    ;(hospitals || []).forEach((h) => {
      if (h.lat == null || h.lng == null) return
      const key = `${Number(h.lat).toFixed(4)},${Number(h.lng).toFixed(4)}`
      locationCounts.set(key, (locationCounts.get(key) || 0) + 1)
    })
    const locationSeen = new Map()

    ;(hospitals || []).forEach((h) => {
      if (h.lat == null || h.lng == null) return
      const markerCost = getCost(h)
      const key = `${Number(h.lat).toFixed(4)},${Number(h.lng).toFixed(4)}`
      const totalAtPoint = locationCounts.get(key) || 1
      const currentIdx = locationSeen.get(key) || 0
      locationSeen.set(key, currentIdx + 1)

      const angle = (currentIdx / Math.max(1, totalAtPoint)) * Math.PI * 2
      const radius = totalAtPoint > 1 ? 0.006 : 0
      const markerLat = Number(h.lat) + Math.sin(angle) * radius
      const markerLng = Number(h.lng) + Math.cos(angle) * radius

      const el = document.createElement('button')
      el.type = 'button'
      el.style.width = '50px'
      el.style.height = '24px'
      el.style.borderRadius = '999px'
      const tier = h.priceTier || h.price_position_tier
      const network = h.networkStatus || h.network_status || 'unknown'
      const bg = tierColor(tier)
      el.style.border = network === 'in_network' ? '1px solid rgba(255,255,255,0.85)' : '1px solid #c4d4c8'
      el.style.background = network === 'in_network' ? bg : 'rgba(36, 46, 40, 0.92)'
      el.style.color = '#fffcf7'
      el.style.fontSize = '11px'
      el.style.fontWeight = '700'
      el.style.cursor = 'pointer'
      el.style.boxShadow = '0 6px 18px rgba(26, 46, 36, 0.22)'
      el.style.zIndex = '2'
      el.style.padding = '0 8px'
      el.style.display = 'inline-flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.pointerEvents = 'auto'
      el.style.touchAction = 'manipulation'
      el.textContent = compactCost(markerCost)
      const negotiated = h.negotiated_rate_total ?? h.negotiated_rate
      const oop = h.estimated_oop_total ?? h.estimated_oop ?? h.estimatedOOP
      el.title = oop != null
        ? `${h.name} • Negotiated Rate ${formatCost(negotiated)} • Estimated Out-of-Pocket ${formatCost(oop)}`
        : `${h.name} • Negotiated Rate ${formatCost(negotiated)}`
      el.setAttribute('aria-label', `Open details for ${h.name}`)

      const handleMarkerClick = (evt) => {
        evt.preventDefault()
        evt.stopPropagation()
        if (onHospitalPreview) onHospitalPreview(h)
      }
      el.addEventListener('mousedown', (evt) => evt.stopPropagation())
      el.addEventListener('mouseup', (evt) => evt.stopPropagation())
      el.addEventListener('touchstart', (evt) => evt.stopPropagation(), { passive: true })
      el.addEventListener('click', handleMarkerClick)

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([markerLng, markerLat])
        .addTo(map)
      markersRef.current.push(marker)
    })
  }, [hospitals, getCost, onHospitalPreview])

  return (
    <div style={{ position: 'relative', marginBottom: 18 }}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: 500,
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: 'linear-gradient(180deg, #e8ebe4 0%, #dce3db 100%)',
        }}
      />
    </div>
  )
}
