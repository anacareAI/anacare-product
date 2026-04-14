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
