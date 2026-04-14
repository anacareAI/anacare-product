// Auth: Clerk only. Enable Organizations in Clerk Dashboard (Configure → Organizations) so users can create/switch orgs.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'
import MissingClerkConfig from './MissingClerkConfig.jsx'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {!clerkPubKey ? (
      <MissingClerkConfig />
    ) : (
      <ClerkProvider publishableKey={clerkPubKey} signInUrl="/sign-in" signUpUrl="/sign-up">
        <App />
      </ClerkProvider>
    )}
  </StrictMode>,
)
