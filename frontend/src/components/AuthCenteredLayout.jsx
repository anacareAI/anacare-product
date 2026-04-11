/**
 * Full-viewport flex centering for Clerk auth surfaces (sign-in after logout, sign-up, org flows).
 */
export default function AuthCenteredLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-page-inner">{children}</div>
    </div>
  )
}

/** Shared so Clerk root/card don’t stretch edge-to-edge or sit top-aligned. */
export const clerkAuthAppearance = {
  elements: {
    rootBox: 'auth-clerk-root',
    card: 'auth-clerk-card',
  },
  variables: {
    colorPrimary: '#3d7348',
    colorText: '#1a2e24',
    colorTextSecondary: '#5a6560',
    colorBackground: '#ffffff',
    colorInputBackground: '#f1f3f5',
    colorInputText: '#1a2e24',
  },
}
