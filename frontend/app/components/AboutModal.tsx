'use client'
import { useState } from 'react'
import { X, Globe, Mail, Code2 } from 'lucide-react'

export default function AboutModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
      >
        About
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-sm mx-4 bg-[#12151f] border border-[#2a2d3a] rounded-2xl shadow-2xl p-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* App icon + name */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">WooCommerce Bulk Uploader</p>
                <p className="text-xs text-slate-500">v2.0.0</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              A standalone desktop app to bulk-upload product images directly to WooCommerce — with auto-category, SKU parsing, CSV export, and resume support.
            </p>

            {/* Divider */}
            <div className="border-t border-[#2a2d3a] mb-4" />

            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-3">Developer</p>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-slate-300">MI</span>
                </div>
                <span className="text-sm text-white font-medium">Muhammad Imran</span>
              </div>

              <a
                href="https://metaaffinity.net"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <span className="text-sm text-blue-400 group-hover:text-blue-300 transition-colors">metaaffinity.net</span>
              </a>

              <a
                href="mailto:metaaffinity@gmail.com"
                className="flex items-center gap-2.5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <span className="text-sm text-blue-400 group-hover:text-blue-300 transition-colors">metaaffinity@gmail.com</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
