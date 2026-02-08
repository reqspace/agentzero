'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-error">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8V12M12 16H12.01" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-text-1 mb-2">Something went wrong</h2>
      <p className="text-sm text-text-3 mb-1 max-w-md">{error.message}</p>
      <pre className="text-xs text-text-3 bg-bg-2 border border-border rounded-xl p-3 mb-4 max-w-lg overflow-auto text-left">
        {error.stack?.slice(0, 500)}
      </pre>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-xl gradient-btn text-white text-sm cursor-pointer"
      >
        Try again
      </button>
    </div>
  )
}
