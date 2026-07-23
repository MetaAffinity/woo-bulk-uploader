import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import AboutModal from './components/AboutModal'

export const metadata: Metadata = {
  title: 'WooCommerce Bulk Uploader',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0d0f17] text-white antialiased">
        <nav className="border-b border-[#2a2d3a] bg-[#12151f] px-6 py-3 flex items-center gap-6">
          <span className="text-sm font-bold text-white tracking-wide">WooCommerce Bulk Uploader</span>
          <div className="flex items-center gap-1 ml-4">
            <Link
              href="/bulk-upload"
              className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Bulk Upload
            </Link>
            <Link
              href="/settings"
              className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Settings
            </Link>
          </div>
          <AboutModal />
        </nav>
        {children}
        <footer className="border-t border-[#2a2d3a] bg-[#12151f] px-6 py-2.5 flex items-center justify-end gap-1 text-[11px] text-slate-600">
          <span>Developed by</span>
          <span className="text-slate-500 font-medium">Muhammad Imran</span>
          <span>·</span>
          <a href="mailto:metaaffinity@gmail.com" className="text-slate-500 hover:text-slate-300 transition-colors">metaaffinity@gmail.com</a>
        </footer>
      </body>
    </html>
  )
}
