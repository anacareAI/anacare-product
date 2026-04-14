import { Component, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import {
  SignedIn,
  SignedOut,
  RedirectToSignIn,
  SignIn,
  SignUp,
  CreateOrganization,
  OrganizationProfile,
  useAuth,
} from '@clerk/clerk-react'
import useTheme from './useTheme'
import AuthCenteredLayout from './components/AuthCenteredLayout'
import { clerkAuthAppearance } from './clerkAppearance'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ResultsPage = lazy(() => import('./pages/ResultsPage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))
const InsuranceOnboarding = lazy(() => import('./pages/InsuranceOnboarding'))

/** Catches lazy-route and render errors so a failed chunk does not leave a blank screen. */
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RouteErrorBoundary]', error, errorInfo?.componentStack)
  }

  render() {
    if (this.state.error) {
      const err = this.state.error
      const showDetail = typeof import.meta !== 'undefined' && import.meta.env?.DEV
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            background: 'var(--bg, #f8f9fa)',
            color: 'var(--text, #1a2e24)',
            textAlign: 'center',
            maxWidth: 520,
            margin: '0 auto',
          }}
        >
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>This page could not be loaded</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9, marginBottom: 20 }}>
            Try a hard refresh. If the problem continues, return home and start a new search.
          </p>
          {showDetail && err?.message && (
            <pre
              style={{
                textAlign: 'left',
                fontSize: 12,
                color: 'var(--text-2, #4a5568)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginBottom: 16,
                maxWidth: '100%',
              }}
            >
              {String(err.message)}
            </pre>
          )}
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null })
              window.location.assign('/home')
            }}
            style={{
              border: 'none',
              background: 'var(--accent, #2d5a3d)',
              color: 'var(--accent-text, #fff)',
              borderRadius: 12,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go to home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppShell() {
  const { theme, toggle } = useTheme()
  const { isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg, #f8f9fa)',
          color: 'var(--text, #1a2e24)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Loading…
      </div>
    )
  }

  const pageFallback = (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #f8f9fa)',
        color: 'var(--text, #1a2e24)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      Loading…
    </div>
  )

  return (
    <BrowserRouter>
      <Suspense fallback={pageFallback}>
        <Routes>
          {/* Sign-in page (dedicated route) */}
          <Route
            path="/sign-in/*"
            element={
              <>
                <SignedIn>
                  <Navigate to="/home" replace />
                </SignedIn>
                <SignedOut>
                  <AuthCenteredLayout>
                    <SignIn
                      routing="path"
                      path="/sign-in"
                      appearance={clerkAuthAppearance}
                      signUpUrl="/sign-up"
                      fallbackRedirectUrl="/home"
                    />
                  </AuthCenteredLayout>
                </SignedOut>
              </>
            }
          />
          <Route
            path="/sign-up/*"
            element={
              <AuthCenteredLayout>
                <SignUp
                  routing="path"
                  path="/sign-up"
                  appearance={clerkAuthAppearance}
                  signInUrl="/sign-in"
                  fallbackRedirectUrl="/onboarding/insurance"
                />
              </AuthCenteredLayout>
            }
          />
          <Route
            path="/onboarding/insurance"
            element={
              <>
                <SignedOut><Navigate to="/" replace /></SignedOut>
                <SignedIn><InsuranceOnboarding /></SignedIn>
              </>
            }
          />
          <Route
            path="/create-organization/*"
            element={
              <>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
                <SignedIn>
                  <AuthCenteredLayout>
                    <CreateOrganization
                      routing="path"
                      path="/create-organization"
                      appearance={clerkAuthAppearance}
                    />
                  </AuthCenteredLayout>
                </SignedIn>
              </>
            }
          />
          <Route
            path="/organization/*"
            element={
              <>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
                <SignedIn>
                  <AuthCenteredLayout>
                    <OrganizationProfile
                      routing="path"
                      path="/organization"
                      appearance={clerkAuthAppearance}
                    />
                  </AuthCenteredLayout>
                </SignedIn>
              </>
            }
          />

          {/* Landing page: signed-in users auto-redirect to /home */}
          <Route
            path="/"
            element={
              <>
                <SignedIn>
                  <Navigate to="/home" replace />
                </SignedIn>
                <SignedOut>
                  <LandingPage />
                </SignedOut>
              </>
            }
          />

          {/* Main app pages — accessible to everyone (guest + signed-in) */}
          <Route path="/home" element={<HomePage theme={theme} onToggleTheme={toggle} />} />
          <Route
            path="/results"
            element={(
              <RouteErrorBoundary>
                <ResultsPage theme={theme} onToggleTheme={toggle} />
              </RouteErrorBoundary>
            )}
          />
          <Route path="/feedback" element={<FeedbackPage theme={theme} onToggleTheme={toggle} />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default function App() {
  return <AppShell />
}
