import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { hospitals, haversine } from '../data/costEngine'

const TIER_COLORS = { 1: '#1db954', 2: '#0e7490', 3: '#f97316' }
const USER_COLOR = '#e05a4f'

function makeDot(color, size = 8) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function tierLabel(t) {
  if (t === 1) return 'Tier 1 — Academic'
  if (t === 2) return 'Tier 2 — Regional'
  return 'Tier 3 — Community'
}

export default function HospitalMap({ lat, lng, radiusMiles = 50 }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)
  const circleRef = useRef(null)
  const [nearbyCount, setNearbyCount] = useState(null)
  const [tierCounts, setTierCounts] = useState({ 1: 0, 2: 0, 3: 0 })

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = L.map(mapRef.current, { zoomControl: true }).setView([39.5, -98.35], 4)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 18,
    }).addTo(map)
    mapInstance.current = map

    hospitals.forEach(h => {
      const color = TIER_COLORS[h.tier] || TIER_COLORS[3]
      const marker = L.marker([h.lat, h.lng], { icon: makeDot(color) })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:13px;color:#1a3a2a;margin-bottom:2px">${h.name}</div>
            <div style="font-size:11px;color:#666">${h.system}</div>
            <div style="margin-top:6px;display:flex;gap:8px;font-size:11px;color:#555;flex-wrap:wrap">
              <span>${h.city}, ${h.state}</span>
              <span>★ ${h.cms_stars}</span>
              <span>${tierLabel(h.tier)}</span>
            </div>
            <div style="margin-top:4px;font-size:10px;color:#999">RAND: ${h.rand_multiplier}×</div>
          </div>
        `)
      markersRef.current.push(marker)
    })

    return () => {
      map.remove()
      mapInstance.current = null
      markersRef.current = []
    }
  }, [])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current)
      userMarkerRef.current = null
    }
    if (circleRef.current) {
      map.removeLayer(circleRef.current)
      circleRef.current = null
    }

    if (lat == null || lng == null) {
      setNearbyCount(null)
      setTierCounts({ 1: 0, 2: 0, 3: 0 })
      return
    }

    userMarkerRef.current = L.marker([lat, lng], { icon: makeDot(USER_COLOR, 14) })
      .addTo(map)
      .bindPopup('<div style="font-weight:700;font-size:13px;color:#1a3a2a">Your location</div>')

    if (radiusMiles > 0) {
      const radiusM = radiusMiles * 1609.34
      circleRef.current = L.circle([lat, lng], {
        radius: radiusM,
        color: '#4a7c59', weight: 2,
        fillColor: '#7fb992', fillOpacity: 0.06,
        dashArray: '6 4',
      }).addTo(map)
      map.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] })
    } else {
      map.setView([lat, lng], 10)
    }

    const nearby = hospitals.filter(
      h => haversine(lat, lng, h.lat, h.lng) <= (radiusMiles || 9999)
    )
    setNearbyCount(nearby.length)
    setTierCounts({
      1: nearby.filter(h => h.tier === 1).length,
      2: nearby.filter(h => h.tier === 2).length,
      3: nearby.filter(h => h.tier === 3).length,
    })
  }, [lat, lng, radiusMiles])

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10, flexWrap: 'wrap', gap: 8,
      }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Hospital coverage
          <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-2)', marginLeft: 8 }}>
            {hospitals.length.toLocaleString()} hospitals nationwide
          </span>
        </h4>
        {nearbyCount != null && (
          <div style={{
            padding: '4px 12px', background: 'var(--accent-soft)',
            borderRadius: 20, fontSize: 13, color: 'var(--accent)', fontWeight: 600,
          }}>
            {nearbyCount} in range
          </div>
        )}
      </div>

      <div
        ref={mapRef}
        style={{
          width: '100%', height: 380, borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border)',
        }}
      />

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 10, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-2)' }}>
          {[
            { color: TIER_COLORS[1], label: 'Tier 1 Academic', count: tierCounts[1] },
            { color: TIER_COLORS[2], label: 'Tier 2 Regional', count: tierCounts[2] },
            { color: TIER_COLORS[3], label: 'Tier 3 Community', count: tierCounts[3] },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0,
              }} />
              {item.label}
              {nearbyCount != null && <span style={{ fontWeight: 600 }}>({item.count})</span>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: USER_COLOR, flexShrink: 0 }} />
          You
        </div>
      </div>

      {nearbyCount != null && (
        <div style={{
          marginTop: 10, padding: '10px 16px',
          background: 'var(--surface-2)', borderRadius: 'var(--radius)',
          border: '1px dashed var(--border)',
          fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5,
        }}>
          Showing hospitals within <strong>{radiusMiles} miles</strong> of your location.
          Prices are based on RAND hospital-specific commercial multipliers (avg 1.80× Medicare).
        </div>
      )}
    </div>
  )
}
