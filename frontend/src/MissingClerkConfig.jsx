export default function MissingClerkConfig() {
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
        background: '#f8f9fa',
        color: '#1a2e24',
        textAlign: 'center',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>Missing Clerk configuration</h1>
      <p style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>
        Add <code style={{ color: '#2d5a3d' }}>VITE_CLERK_PUBLISHABLE_KEY</code> in your Vercel project → Settings →
        Environment Variables (Production), then redeploy. Use your <code style={{ color: '#2d5a3d' }}>pk_test_...</code>{' '}
        or <code style={{ color: '#2d5a3d' }}>pk_live_...</code> key from the Clerk dashboard.
      </p>
    </div>
  )
}
