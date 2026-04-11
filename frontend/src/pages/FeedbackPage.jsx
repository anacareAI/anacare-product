import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'

const CATEGORIES = [
  'General Feedback',
  'Bug Report',
  'Feature Request',
  'Pricing Data Issue',
  'Other',
]

const RATINGS = [1, 2, 3, 4, 5]

const WEB3FORMS_KEY = '0d89c0a3-3ab9-4bc3-9b3e-23d229295a55'

export default function FeedbackPage({ theme, onToggleTheme }) {
  const { user } = useUser()
  const navigate = useNavigate()

  const [category, setCategory] = useState('')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  const canSubmit = category && rating > 0 && message.trim().length > 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || status === 'sending') return

    setStatus('sending')
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `AnaCare Feedback: ${category}`,
          from_name: user?.fullName || user?.primaryEmailAddress?.emailAddress || 'AnaCare User',
          email: user?.primaryEmailAddress?.emailAddress || 'no-reply@anacare.ai',
          category,
          rating: `${rating}/5`,
          message,
        }),
      })

      if (res.ok) {
        setStatus('sent')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <>
        <Header theme={theme} onToggleTheme={onToggleTheme} />
        <div style={styles.page}>
          <div style={styles.card}>
            <div style={styles.successIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="7 13 11 17 17 7" />
              </svg>
            </div>
            <h2 style={styles.title}>Thank you!</h2>
            <p style={styles.subtitle}>Your feedback has been sent. We appreciate you helping us improve AnaCare.</p>
            <button type="button" style={styles.btn} onClick={() => navigate('/home')}>
              Back to home
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        .fb-rating-btn {
          width: 40px; height: 40px; border-radius: 50%;
          border: 2px solid var(--border); background: var(--surface);
          color: var(--text-2); font-size: 16px; font-weight: 600;
          cursor: pointer; transition: all 150ms ease; font-family: inherit;
          display: flex; align-items: center; justify-content: center;
        }
        .fb-rating-btn:hover { border-color: var(--green); color: var(--green); }
        .fb-rating-btn.active {
          background: var(--green); border-color: var(--green);
          color: #fff;
        }
        .fb-select {
          width: 100%; padding: 10px 14px; border-radius: var(--radius);
          border: 1px solid var(--border); background: var(--surface);
          color: var(--text); font-size: 14px; font-family: inherit;
          appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
        }
        .fb-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); outline: none; }
        .fb-textarea {
          width: 100%; min-height: 120px; padding: 12px 14px;
          border-radius: var(--radius); border: 1px solid var(--border);
          background: var(--surface); color: var(--text); font-size: 14px;
          font-family: inherit; resize: vertical; line-height: 1.5;
        }
        .fb-textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); outline: none; }
        .fb-textarea::placeholder { color: var(--text-3); }
      `}</style>

      <Header theme={theme} onToggleTheme={onToggleTheme} />

      <div style={styles.page}>
        <div style={styles.card}>
          <h2 style={styles.title}>Share your feedback</h2>
          <p style={styles.subtitle}>
            Help us improve AnaCare. Your feedback goes directly to our team.
          </p>

          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Name + Email (auto-filled, read-only) */}
            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  readOnly
                  value={user?.fullName || ''}
                  style={{ ...styles.readonlyInput }}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input
                  type="text"
                  readOnly
                  value={user?.primaryEmailAddress?.emailAddress || ''}
                  style={{ ...styles.readonlyInput }}
                />
              </div>
            </div>

            {/* Category */}
            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              <select
                className="fb-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="" disabled>Select a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Rating */}
            <div style={styles.field}>
              <label style={styles.label}>Rating</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {RATINGS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`fb-rating-btn ${rating === r ? 'active' : ''}`}
                    onClick={() => setRating(r)}
                    aria-label={`Rate ${r} out of 5`}
                  >
                    {r}
                  </button>
                ))}
                <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-3)' }}>
                  {rating === 1 && 'Poor'}
                  {rating === 2 && 'Fair'}
                  {rating === 3 && 'Good'}
                  {rating === 4 && 'Great'}
                  {rating === 5 && 'Excellent'}
                </span>
              </div>
            </div>

            {/* Message */}
            <div style={styles.field}>
              <label style={styles.label}>Your feedback</label>
              <textarea
                className="fb-textarea"
                placeholder="Tell us what you think..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {status === 'error' && (
              <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 500 }}>
                Something went wrong. Please try again.
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || status === 'sending'}
              style={{
                ...styles.btn,
                opacity: canSubmit && status !== 'sending' ? 1 : 0.5,
                cursor: canSubmit && status !== 'sending' ? 'pointer' : 'not-allowed',
              }}
            >
              {status === 'sending' ? 'Sending...' : 'Submit feedback'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 96,
    paddingBottom: 48,
    paddingLeft: 16,
    paddingRight: 16,
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: 32,
    boxShadow: 'var(--shadow-lg)',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-2)',
    marginBottom: 24,
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-2)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  readonlyInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text-3)',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  btn: {
    width: '100%',
    padding: '12px 20px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-text)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 150ms ease',
    marginTop: 4,
  },
  successIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 16,
  },
}
