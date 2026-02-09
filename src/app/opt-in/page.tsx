export const metadata = {
  title: 'Agent Zero — SMS Opt-In',
}

export default function OptInPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      color: '#e5e5e5',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: '#141414',
        border: '1px solid #262626',
        borderRadius: '12px',
        padding: '2.5rem',
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff' }}>
          Agent Zero
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#a3a3a3', marginBottom: '2rem' }}>
          AI-powered SMS assistant
        </p>

        <div style={{
          background: '#1a1a2e',
          border: '1px solid #2d2d5e',
          borderRadius: '8px',
          padding: '1.5rem',
          textAlign: 'center',
          marginBottom: '2rem',
        }}>
          <p style={{ fontSize: '0.75rem', color: '#a3a3a3', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Text us at
          </p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>
            +1 (866) 617-0069
          </p>
        </div>

        <div style={{ fontSize: '0.8125rem', lineHeight: '1.6', color: '#a3a3a3' }}>
          <p style={{ marginBottom: '1rem' }}>
            By sending a text message to this number, you opt in to receive SMS replies from Agent Zero.
            Standard message and data rates may apply.
          </p>
          <p style={{ marginBottom: '1rem' }}>
            <strong style={{ color: '#d4d4d4' }}>How it works:</strong> Send us a message and our AI assistant
            will respond via SMS. We only reply to messages you send — we will never initiate unsolicited texts.
          </p>
          <p style={{ marginBottom: '1rem' }}>
            <strong style={{ color: '#d4d4d4' }}>Opt out:</strong> Reply <span style={{
              background: '#262626', padding: '0.125rem 0.375rem', borderRadius: '4px', fontFamily: 'monospace'
            }}>STOP</span> at any time to stop receiving messages.
          </p>
          <p>
            <strong style={{ color: '#d4d4d4' }}>Help:</strong> Reply <span style={{
              background: '#262626', padding: '0.125rem 0.375rem', borderRadius: '4px', fontFamily: 'monospace'
            }}>HELP</span> for assistance.
          </p>
        </div>

        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #262626',
          fontSize: '0.75rem',
          color: '#525252',
        }}>
          <p>Agent Zero by Reqspace &bull; SMS Terms of Service</p>
        </div>
      </div>
    </div>
  )
}
