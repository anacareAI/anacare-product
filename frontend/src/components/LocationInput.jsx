import { useEffect, useRef, useState, useCallback } from 'react'

export default function LocationInput({ onChange }) {
  const [zipInput, setZipInput] = useState('')
  const [location, setLocation] = useState({ lat: null, lng: null, zip: '', city: '', state: '' })
  const [radius, setRadius] = useState(25)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const zipRequestId = useRef(0)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (typeof onChangeRef.current !== 'function') return
    onChangeRef.current({
      lat: location.lat,
      lng: location.lng,
      zip: location.zip || null,
      radius_miles: radius,
    })
  }, [location.lat, location.lng, location.zip, radius])

  const hasCoords =
    location.lat != null &&
    location.lng != null &&
    !Number.isNaN(Number(location.lat)) &&
    !Number.isNaN(Number(location.lng))

  const geocodeZip = useCallback(async (raw) => {
    if (raw.length < 5) return
    const id = ++zipRequestId.current
    setStatus('Looking up...')
    setError('')

    try {
      const res = await fetch('https://api.zippopotam.us/us/' + raw)
      if (id !== zipRequestId.current) return
      if (!res.ok) {
        setError('Invalid ZIP code.')
        setStatus('')
        return
      }
      const geo = await res.json()
      const place = geo.places?.[0]
      if (!place) {
        setError('Invalid ZIP code.')
        setStatus('')
        return
      }
      setLocation({
        lat: parseFloat(place.latitude),
        lng: parseFloat(place.longitude),
        zip: raw,
        city: place['place name'] ?? '',
        state: place['state abbreviation'] ?? '',
      })
      setStatus('')
      setError('')
    } catch {
      if (id !== zipRequestId.current) return
      setError('Could not verify ZIP code.')
      setStatus('')
    }
  }, [])

  const handleZipChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 5)
    setZipInput(raw)
    setError('')
    if (raw.length < 5) {
      setStatus('')
      return
    }
    geocodeZip(raw)
  }

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser.')
      return
    }
    setStatus('Locating...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          zip: '',
          city: 'Current location',
          state: '',
        })
        setStatus('')
        setError('')
      },
      () => {
        setError('Location access denied. Please enter a ZIP code.')
        setStatus('')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const RADIUS_OPTIONS = [
    { value: 5, label: '5 mi' },
    { value: 10, label: '10 mi' },
    { value: 25, label: '25 mi' },
    { value: 50, label: '50 mi' },
  ]

  return (
    <div>
      {hasCoords && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          padding: '10px 16px', background: 'var(--accent-soft)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius-lg)', fontSize: 14, color: 'var(--text)', fontWeight: 500,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <span style={{ flex: 1 }}>
            {location.city ? `${location.city}${location.state ? `, ${location.state}` : ''}` : 'Current location'}
            {location.zip ? ` (${location.zip})` : ''}
          </span>
          <button type="button" onClick={() => {
            setLocation({ lat: null, lng: null, zip: '', city: '', state: '' })
            setZipInput('')
          }} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--text-3)', fontSize: 18, lineHeight: 1, padding: 0,
          }}>x</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
        <div>
          <div style={{
            position: 'relative', display: 'flex', alignItems: 'center',
            background: 'var(--surface-2)',
            border: `2px solid ${isFocused ? 'var(--accent)' : error ? 'var(--red)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)', padding: '0 16px',
            transition: 'border-color 200ms ease, box-shadow 200ms ease',
            boxShadow: isFocused ? '0 0 0 3px var(--accent-soft)' : 'none',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="Enter ZIP code (e.g. 10001)"
              maxLength={5}
              value={zipInput}
              onChange={handleZipChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              style={{
                flex: 1, border: 'none', background: 'transparent', outline: 'none',
                padding: '14px 12px', fontSize: 15, color: 'var(--text)',
                fontFamily: 'inherit',
              }}
            />
            {!hasCoords && (
              <button
                type="button"
                onClick={handleUseLocation}
                title="Use current location"
                style={{
                  border: 'none', background: 'var(--accent)', color: 'var(--accent-text)',
                  borderRadius: 'var(--radius)', padding: '6px 12px', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
                </svg>
                Locate me
              </button>
            )}
          </div>
          {status && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--text-3)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              {status}
            </div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{error}</div>
          )}
        </div>

        <div>
          <div style={{
            display: 'flex', alignItems: 'center', background: 'var(--surface-2)',
            border: '2px solid var(--border)', borderRadius: 'var(--radius-lg)',
            padding: '0 4px', height: 50,
          }}>
            {RADIUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRadius(opt.value)}
                style={{
                  border: 'none',
                  background: radius === opt.value ? 'var(--accent)' : 'transparent',
                  color: radius === opt.value ? 'var(--accent-text)' : 'var(--text-2)',
                  borderRadius: 'var(--radius)', padding: '6px 12px', cursor: 'pointer',
                  fontSize: 13, fontWeight: radius === opt.value ? 600 : 400,
                  fontFamily: 'inherit', transition: 'all 150ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
