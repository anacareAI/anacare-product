import { useState, useEffect } from 'react'

const ROTATING_WORDS = [
  'colonoscopy',
  'MRI',
  'knee replacement',
  'tonsil removal',
  'cataract surgery',
  'CT scan',
  'mammogram',
  'hernia repair',
]

export default function Hero() {
  const [wordIndex, setWordIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setWordIndex((i) => (i + 1) % ROTATING_WORDS.length)
        setFade(true)
      }, 400)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="hero-section">
      <style>{`
        .hero-section {
          padding: 120px 24px 56px;
          text-align: center;
          background: var(--page-canvas, #f8f9fa);
          transition: background 200ms ease;
        }
        .hero-box {
          max-width: 720px;
          margin: 0 auto;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 48px 40px 40px;
          box-shadow: 0 16px 64px rgba(15, 23, 42, 0.06), 0 4px 16px rgba(15, 23, 42, 0.04);
          position: relative;
          overflow: hidden;
        }
        .hero-box::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--accent), var(--green), var(--accent));
          opacity: 0.8;
        }
        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--green);
          margin-bottom: 20px;
        }
        .hero-eyebrow-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green);
          animation: hero-pulse 2s ease-in-out infinite;
        }
        @keyframes hero-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        .hero-title {
          font-size: 40px;
          font-weight: 750;
          letter-spacing: -1.5px;
          margin: 0 auto;
          line-height: 1.15;
          color: var(--text);
        }
        .hero-subtitle {
          font-size: 17px;
          color: var(--text-2);
          margin-top: 12px;
          line-height: 1.55;
          max-width: 520px;
          margin-left: auto;
          margin-right: auto;
        }
        .hero-rotating-word {
          display: block;
          color: var(--green);
          transition: opacity 0.4s ease, transform 0.4s ease;
          min-height: 1.2em;
        }
        .hero-rotating-word.fade-out {
          opacity: 0;
          transform: translateY(8px);
        }
        .hero-rotating-word.fade-in {
          opacity: 1;
          transform: translateY(0);
        }
        .hero-features {
          display: flex;
          justify-content: center;
          gap: 32px;
          margin-top: 28px;
          padding-top: 24px;
          border-top: 1px solid var(--border);
        }
        .hero-feature {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--text-2);
          font-weight: 500;
        }
        .hero-check-icon {
          color: var(--green);
          flex-shrink: 0;
        }
        @media (max-width: 768px) {
          .hero-section { padding: 100px 16px 32px; }
          .hero-box { padding: 32px 20px 28px; border-radius: 18px; }
          .hero-title { font-size: 28px; letter-spacing: -0.8px; }
          .hero-subtitle { font-size: 15px; }
          .hero-features { flex-direction: column; align-items: center; gap: 10px; }
        }
      `}</style>

      <div className="hero-box">
        <div className="hero-eyebrow">
          <span className="hero-eyebrow-dot" />
          Healthcare Price Transparency
        </div>

        <h1 className="hero-title">
          Find your procedure options.
          <span className={`hero-rotating-word ${fade ? 'fade-in' : 'fade-out'}`}>
            {ROTATING_WORDS[wordIndex]}
          </span>
        </h1>

        <p className="hero-subtitle">
          We'll locate hospitals near you and estimate your full out-of-pocket cost.
        </p>

        <div className="hero-features">
          {[
            'Compare prices across providers',
            'Estimate your out-of-pocket cost',
            'CMS-verified hospital data',
          ].map((text) => (
            <div key={text} className="hero-feature">
              <svg className="hero-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
