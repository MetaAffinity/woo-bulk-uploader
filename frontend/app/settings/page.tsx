'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Save, CheckCircle2, XCircle, Loader2, Wifi, Eye, EyeOff } from 'lucide-react'

type Config = {
  site_url: string
  wc_consumer_key: string
  wc_consumer_secret: string
  wp_username: string
  wp_app_password: string
}

const EMPTY: Config = {
  site_url: '',
  wc_consumer_key: '',
  wc_consumer_secret: '',
  wp_username: '',
  wp_app_password: '',
}

export default function SettingsPage() {
  const [form, setForm]         = useState<Config>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [testing, setTesting]   = useState(false)
  const [saved, setSaved]       = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean; wc_ok?: boolean; wp_ok?: boolean; wc_error?: string; wp_error?: string
  } | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [showAppPass, setShowAppPass] = useState(false)

  useEffect(() => {
    api.getSettings().then((cfg: any) => {
      if (cfg && cfg.site_url) setForm(cfg)
    }).catch(() => {})
  }, [])

  function set(field: keyof Config, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
    setTestResult(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setTestResult(null)
    try {
      await api.saveSettings(form)
      setSaved(true)
      // Auto-validate after save
      setTesting(true)
      try {
        const r: any = await api.testConnection()
        setTestResult(r)
      } catch (e: any) {
        setTestResult({ ok: false, wc_error: e.message })
      } finally {
        setTesting(false)
      }
    } catch (e: any) {
      alert('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    // Save first so test uses latest values
    try { await api.saveSettings(form) } catch {}
    try {
      const r: any = await api.testConnection()
      setTestResult(r)
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0f17] flex flex-col">
      <div className="border-b border-[#2a2d3a] bg-[#12151f] px-8 py-5">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Enter your WooCommerce site credentials</p>
      </div>

      <div className="flex-1 flex items-start justify-center p-8">
        <div className="w-full max-w-lg space-y-5">

          {/* Site URL */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              WordPress Site URL
            </label>
            <input
              type="text"
              placeholder="https://yourstore.com"
              value={form.site_url}
              onChange={e => set('site_url', e.target.value)}
              className="w-full bg-[#12151f] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* WooCommerce Keys */}
          <div className="rounded-xl border border-[#2a2d3a] overflow-hidden">
            <div className="px-4 py-3 bg-white/[0.02] border-b border-[#2a2d3a]">
              <p className="text-xs font-semibold text-slate-300">WooCommerce REST API Keys</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                WooCommerce → Settings → Advanced → REST API → Add key (Read/Write)
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Consumer Key</label>
                <input
                  type="text"
                  placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={form.wc_consumer_key}
                  onChange={e => set('wc_consumer_key', e.target.value)}
                  className="w-full bg-[#0d0f17] border border-[#2a2d3a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Consumer Secret</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={form.wc_consumer_secret}
                    onChange={e => set('wc_consumer_secret', e.target.value)}
                    className="w-full bg-[#0d0f17] border border-[#2a2d3a] rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    onClick={() => setShowSecret(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* WordPress credentials */}
          <div className="rounded-xl border border-[#2a2d3a] overflow-hidden">
            <div className="px-4 py-3 bg-white/[0.02] border-b border-[#2a2d3a]">
              <p className="text-xs font-semibold text-slate-300">WordPress Login (for image uploads)</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Users → Your profile → Application Passwords → Add new
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">WP Username</label>
                <input
                  type="text"
                  placeholder="admin"
                  value={form.wp_username}
                  onChange={e => set('wp_username', e.target.value)}
                  className="w-full bg-[#0d0f17] border border-[#2a2d3a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Application Password</label>
                <div className="relative">
                  <input
                    type={showAppPass ? 'text' : 'password'}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    value={form.wp_app_password}
                    onChange={e => set('wp_app_password', e.target.value)}
                    className="w-full bg-[#0d0f17] border border-[#2a2d3a] rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    onClick={() => setShowAppPass(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showAppPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Localhost notice */}
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-yellow-400">Localhost / Local WordPress?</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Application Passwords are disabled by default on localhost. Add this line to your theme&apos;s <span className="text-slate-300 font-mono">functions.php</span> file to enable them:
                </p>
                <div className="bg-[#0d0f17] rounded px-3 py-2 font-mono text-[11px] text-green-400 select-all">
                  add_filter(&apos;wp_is_application_passwords_available&apos;, &apos;__return_true&apos;);
                </div>
                <p className="text-[11px] text-slate-500">
                  After adding, go to <span className="text-slate-300">WordPress Admin → Users → Your Profile</span> → scroll down to <span className="text-slate-300">Application Passwords</span> → enter any name → click <span className="text-slate-300">Add New</span> → copy the generated password.
                </p>
              </div>
            </div>
          </div>

          {/* Test result */}
          {(testResult || testing) && (
            <div className="rounded-xl border border-[#2a2d3a] overflow-hidden">
              <div className="px-4 py-2.5 bg-white/[0.02] border-b border-[#2a2d3a]">
                <p className="text-xs font-semibold text-slate-300">Connection Check</p>
              </div>
              <div className="p-3.5 space-y-2.5">
                {testing && !testResult && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking credentials...
                  </div>
                )}

                {testResult && (
                  <>
                    {/* WooCommerce API */}
                    <div className={`flex items-start gap-2.5 p-2.5 rounded-lg text-xs border ${
                      testResult.wc_ok
                        ? 'bg-green-500/8 border-green-500/20 text-green-400'
                        : 'bg-red-500/8 border-red-500/20 text-red-400'
                    }`}>
                      {testResult.wc_ok
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        : <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      }
                      <div>
                        <p className="font-medium">WooCommerce API</p>
                        {!testResult.wc_ok && testResult.wc_error && (
                          <p className="mt-0.5 text-[11px] opacity-80">{testResult.wc_error}</p>
                        )}
                      </div>
                    </div>

                    {/* WordPress App Password */}
                    <div className={`flex items-start gap-2.5 p-2.5 rounded-lg text-xs border ${
                      testResult.wp_ok
                        ? 'bg-green-500/8 border-green-500/20 text-green-400'
                        : 'bg-red-500/8 border-red-500/20 text-red-400'
                    }`}>
                      {testResult.wp_ok
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        : <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      }
                      <div>
                        <p className="font-medium">WordPress Application Password</p>
                        {!testResult.wp_ok && testResult.wp_error && (
                          <p className="mt-0.5 text-[11px] opacity-80 whitespace-pre-line">{testResult.wp_error}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : saved
                ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                : <Save className="w-4 h-4" />
              }
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !form.site_url}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-slate-300 text-sm font-medium rounded-lg border border-[#2a2d3a] transition-colors"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
