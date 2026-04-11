import { useNavigate, Link } from 'react-router-dom'
import { SignedIn, SignedOut, OrganizationSwitcher, UserButton } from '@clerk/clerk-react'

export default function Header({ planName = null }) {
  const navigate = useNavigate()

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: 56,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          padding: '0 24px',
          maxWidth: 1280,
          margin: '0 auto',
          gap: 16,
        }}
      >
        {/* Logo */}
        <button
          type="button"
          onClick={() => navigate('/home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            gap: 8,
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
          }}
          aria-label="Go to home page"
        >
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden>
            <rect width="32" height="32" rx="8" fill="var(--green)" />
            <path
              d="M16 8c-2.8 0-5 2.1-5 4.7 0 4.2 5 9.3 5 9.3s5-5.1 5-9.3C21 10.1 18.8 8 16 8zm0 6.6a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8z"
              fill="var(--accent-text)"
            />
          </svg>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--accent)',
              whiteSpace: 'nowrap',
            }}
          >
            AnaCare
          </span>
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Signed-in: show org switcher + user button */}
        <SignedIn>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, minWidth: 0 }}>
            <OrganizationSwitcher
              createOrganizationUrl="/create-organization"
              afterCreateOrganizationUrl="/home"
              afterSelectOrganizationUrl="/home"
              afterLeaveOrganizationUrl="/home"
              organizationProfileUrl="/organization"
              appearance={{
                variables: {
                  colorPrimary: '#3d7348',
                  colorText: '#1a2e24',
                  colorTextSecondary: '#5a6560',
                  colorBackground: '#ffffff',
                  colorInputBackground: '#f1f3f5',
                  colorInputText: '#1a2e24',
                },
              }}
            />
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>

        {/* Guest: show sign-in link */}
        <SignedOut>
          <Link
            to="/sign-in"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--accent, #3d7348)',
              background: 'var(--accent-soft, #e8f0e9)',
              textDecoration: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Sign In
          </Link>
        </SignedOut>

        {/* Plan badge */}
        {planName && planName !== "I'm not using insurance" && planName !== "No Insurance / Cash Pay" && (
          <>
            <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 8,
                background: 'var(--accent-soft)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--green)',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              {planName}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
