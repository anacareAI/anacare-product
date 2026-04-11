import { lazy, Suspense } from 'react'
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
import AuthCenteredLayout, { clerkAuthAppearance } from './components/AuthCenteredLayout'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ResultsPage = lazy(() => import('./pages/ResultsPage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))
const InsuranceOnboarding = lazy(() => import('./pages/InsuranceOnboarding'))

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
          <Route path="/results" element={<ResultsPage theme={theme} onToggleTheme={toggle} />} />
          <Route path="/feedback" element={<FeedbackPage theme={theme} onToggleTheme={toggle} />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default function App() {
  return <AppShell />
}
