import { Link } from 'react-router-dom'

/**
 * Signed-out entry — layout from anacare_login_v3.html; routes preserve existing app behavior.
 */
export default function LandingPage() {
  return (
    <div className="ac-login-v3">
      <style>{`
        .ac-login-v3 {
          min-height: 100dvh;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: #eef0ee;
          font-family: 'DM Sans', system-ui, sans-serif;
          box-sizing: border-box;
        }
        .ac-login-v3 *,
        .ac-login-v3 *::before,
        .ac-login-v3 *::after {
          box-sizing: border-box;
        }
        .ac-login-v3 .login-card {
          background: #ffffff;
          border-radius: 18px;
          padding: 2.75rem 2.5rem 2.5rem;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08), 0 6px 24px rgba(0, 0, 0, 0.07);
        }
        .ac-login-v3 .login-logo-row {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 1.75rem;
        }
        .ac-login-v3 .login-logo-icon {
          width: 44px;
          height: 44px;
          background: #2d5a3d;
          border-radius: 11px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .ac-login-v3 .login-logo-text-name {
          font-size: 19px;
          font-weight: 600;
          color: #111;
          margin: 0;
          letter-spacing: -0.3px;
        }
        .ac-login-v3 .login-logo-text-sub {
          font-size: 12.5px;
          color: #888;
          margin: 0;
          font-weight: 400;
        }
        .ac-login-v3 .login-rule {
          height: 1px;
          background: #e8e8e8;
          margin: 0 0 1.6rem;
        }
        .ac-login-v3 .login-tagline {
          font-size: 14.5px;
          color: #555;
          line-height: 1.6;
          margin: 0 0 1.75rem;
          font-weight: 400;
        }
        .ac-login-v3 .login-btn-primary {
          display: block;
          width: 100%;
          padding: 15px;
          background: #2d5a3d;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 10px;
          letter-spacing: 0.1px;
          text-align: center;
          text-decoration: none;
          transition: background 0.2s ease;
        }
        .ac-login-v3 .login-btn-primary:hover {
          background: #254e35;
        }
        .ac-login-v3 .login-btn-primary:focus-visible {
          outline: 2px solid #2d5a3d;
          outline-offset: 3px;
        }
        .ac-login-v3 .login-btn-outline {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          width: 100%;
          padding: 14px;
          background: #ffffff;
          color: #2d5a3d;
          border: 2.5px solid #2d5a3d;
          border-radius: 10px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 10px;
          text-decoration: none;
          transition: background 0.2s ease;
        }
        .ac-login-v3 .login-btn-outline:hover {
          background: #f2f7f4;
        }
        .ac-login-v3 .login-btn-outline:focus-visible {
          outline: 2px solid #2d5a3d;
          outline-offset: 2px;
        }
        .ac-login-v3 .login-divider-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 8px 0;
        }
        .ac-login-v3 .login-divider-line {
          flex: 1;
          height: 1px;
          background: #e0e0e0;
        }
        .ac-login-v3 .login-divider-text {
          font-size: 12px;
          color: #bbb;
          white-space: nowrap;
        }
      `}</style>

      <main className="login-card">
        <header className="login-logo-row">
          <div className="login-logo-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <div>
            <p className="login-logo-text-name">AnaCare</p>
            <p className="login-logo-text-sub">Healthcare price transparency</p>
          </div>
        </header>

        <div className="login-rule" aria-hidden="true" />

        <p className="login-tagline">
          Know what you&apos;ll pay before you go. Compare bundled episode prices and find care near you.
        </p>

        <Link className="login-btn-primary" to="/sign-in">
          Sign in to your account
        </Link>

        <Link className="login-btn-outline" to="/home">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2d5a3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Continue as guest
        </Link>

        <div className="login-divider-row">
          <div className="login-divider-line" />
          <span className="login-divider-text">New to AnaCare?</span>
          <div className="login-divider-line" />
        </div>

        <Link className="login-btn-outline" to="/sign-up">
          Create an account
        </Link>
      </main>
    </div>
  )
}
