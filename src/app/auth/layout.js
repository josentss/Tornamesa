import Link from 'next/link';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#0a0f16] text-[#f0f9ff] flex flex-col">
      <header className="w-full border-b border-[#1e293b]">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-center">
          <Link
            href="/"
            className="text-xl font-bold tracking-tighter text-[#f0f9ff] hover:text-[#7cc7e8] transition-colors"
          >
            Tornamesa
          </Link>
        </div>
      </header>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
