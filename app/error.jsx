'use client';

export default function Error({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080b14]" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
      <div className="text-center py-10 px-5 max-w-[400px]">
        <div className="w-12 h-12 rounded-[13px] bg-[linear-gradient(135deg,#c47d8e,#8b5e6b)] flex items-center justify-center mx-auto mb-5 text-white text-[26px] font-extrabold">N</div>
        <h1 className="text-[22px] font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-white/45 leading-[1.6] mb-6">
          An unexpected error occurred. Please try again or contact support if the issue persists.
        </p>
        <button
          onClick={() => reset()}
          className="py-2.5 px-7 rounded-[10px] bg-[#c47d8e] text-white border-none text-sm font-semibold cursor-pointer font-[inherit] mr-2"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="py-2.5 px-7 rounded-[10px] bg-transparent text-white/50 border border-white/10 text-sm font-medium cursor-pointer font-[inherit]"
        >
          Go home
        </button>
      </div>
    </div>
  );
}
