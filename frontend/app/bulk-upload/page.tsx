"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  Search,
  Upload,
  XCircle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  FolderInput,
  RotateCcw,
  Hash,
  X,
  FolderOpen,
  Settings,
} from "lucide-react";
import Link from "next/link";

type ProductItem = {
  file_path: string;
  filename: string;
  category: string | null;
  subcategory: string | null;
  subsubcategory: string | null;
  name: string;
  sku: string | null;
  sku_auto: boolean;
  price: number | null;
  status: "pending" | "uploading" | "created" | "failed" | "skipped";
  wc_product_id: number | null;
  error: string | null;
};

type SessionStatus = {
  state: "preview" | "running" | "done";
  products: ProductItem[];
  total: number;
  created: number;
  failed: number;
  uploading: number;
  pending: number;
  skipped: number;
};

function StatusIcon({ status }: { status: ProductItem["status"] }) {
  if (status === "created")
    return <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />;
  if (status === "failed")
    return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  if (status === "uploading")
    return (
      <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
    );
  if (status === "skipped")
    return <AlertTriangle className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  return (
    <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
  );
}

function StatusBadge({ status }: { status: ProductItem["status"] }) {
  const map: Record<string, string> = {
    created: "text-green-400 bg-green-500/10 border-green-500/20",
    failed: "text-red-400 bg-red-500/10 border-red-500/20",
    uploading: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    pending: "text-slate-400 bg-white/5 border-white/5",
    skipped: "text-slate-500 bg-white/5 border-white/5",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded border font-medium ${map[status]}`}
    >
      {status}
    </span>
  );
}

type IncompleteSession = {
  session_id: string;
  folder_path: string;
  site_url: string;
  total: number;
  pending: number;
  created: number;
  failed: number;
};

export default function BulkUploadPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [skuPrefix, setSkuPrefix] = useState("");
  const [skuStart, setSkuStart] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [error, setError] = useState("");
  const [incompleteSessions, setIncompleteSessions] = useState<IncompleteSession[]>([]);
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [imgBaseUrl, setImgBaseUrl] = useState('');
  const [forceSku, setForceSku] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((cfg: any) => {
        setConfigured(!!(cfg?.site_url && cfg?.wc_consumer_key));
        if (cfg?.site_url) setSiteUrl(cfg.site_url.replace(/\/$/, ""));
      })
      .catch(() => setConfigured(false));
    api.bulkIncomplete().then((list: any) => setIncompleteSessions(list)).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(sid: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const s: SessionStatus = (await api.bulkStatus(sid)) as any;
        setSession(s);
        if (s.state === "done") stopPolling();
      } catch {
        stopPolling();
      }
    }, 1200);
  }

  async function handleScan() {
    if (!folderPath.trim()) return;
    setError("");
    setScanning(true);
    setSession(null);
    setSessionId(null);
    stopPolling();
    try {
      const res: any = await api.bulkScan(
        folderPath.trim(),
        skuPrefix.trim() || undefined,
        skuStart,
        forceSku,
      );
      setSessionId(res.session_id);
      setSession({
        state: "preview",
        products: res.products,
        total: res.total,
        created: 0,
        failed: 0,
        uploading: 0,
        pending: res.total,
        skipped: 0,
      });
    } catch (e: any) {
      setError(e.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleStart() {
    if (!sessionId) return;
    setError("");
    try {
      await api.bulkStart(sessionId);
      setSession((prev) => (prev ? { ...prev, state: "running" } : prev));
      startPolling(sessionId);
    } catch (e: any) {
      setError(e.message || "Upload failed to start");
    }
  }

  async function handleCancel() {
    if (!sessionId) return;
    stopPolling();
    try {
      await api.bulkCancel(sessionId);
    } catch {}
    setSession((prev) => (prev ? { ...prev, state: "done" } : prev));
  }

  function handleReset() {
    stopPolling();
    setSession(null);
    setSessionId(null);
    setError("");
  }

  async function handleRetry() {
    if (!sessionId) return;
    setError("");
    try {
      await api.bulkRetry(sessionId);
      setSession((prev) => (prev ? { ...prev, state: "running" } : prev));
      startPolling(sessionId);
    } catch (e: any) {
      setError(e.message || "Retry failed");
    }
  }

  async function handleResume(sid: string) {
    setError("");
    setIncompleteSessions([]);
    try {
      await api.bulkResume(sid);
      setSessionId(sid);
      const s: any = await api.bulkStatus(sid);
      setSession(s);
      startPolling(sid);
    } catch (e: any) {
      setError(e.message || "Resume failed");
    }
  }

  async function handleRemoveProduct(index: number) {
    if (!sessionId) return;
    try {
      await api.bulkRemoveProduct(sessionId, index);
      setSession((prev) => {
        if (!prev) return prev;
        const products = prev.products.filter((_, i) => i !== index);
        return {
          ...prev,
          products,
          total: products.length,
          pending: products.filter((p) => p.status === "pending").length,
        };
      });
    } catch (e: any) {
      setError(e.message || "Remove failed");
    }
  }

  const isRunning = session?.state === "running";
  const isDone = session?.state === "done";
  const hasResults = session !== null;
  const hasProducts = (session?.total ?? 0) > 0;
  const autoSkuEnabled = skuPrefix.trim().length > 0;
  const noSkuCount =
    session?.products.filter((p) => !p.sku && !p.sku_auto).length ?? 0;

  // Not configured yet
  if (configured === false) {
    return (
      <div className="min-h-screen bg-[#0d0f17] flex flex-col items-center justify-center gap-4 text-center px-4">
        <Settings className="w-12 h-12 text-slate-600" />
        <p className="text-white font-semibold text-lg">Site not configured</p>
        <p className="text-slate-400 text-sm max-w-sm">
          Fill in your WooCommerce credentials in Settings before uploading
          products.
        </p>
        <Link
          href="/settings"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f17] text-white flex flex-col">
      <div className="border-b border-[#2a2d3a] bg-[#12151f] px-8 py-5 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Bulk Upload</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Create WooCommerce products from a local folder of images
          </p>
        </div>
        {siteUrl && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-green-500/20 bg-green-500/8">
            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <span className="text-xs text-green-300 font-mono">{siteUrl}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-[400px] shrink-0 border-r border-[#2a2d3a] bg-[#12151f] flex flex-col overflow-y-auto">
          <div className="p-5 space-y-5 flex-1">
            {/* Folder path */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                Folder Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. D:\bulk-upload"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  disabled={isRunning}
                  className="flex-1 bg-[#0d0f17] border border-[#2a2d3a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <button
                  onClick={async () => {
                    try {
                      const r = await api.bulkBrowseFolder();
                      if (r.path) setFolderPath(r.path);
                    } catch {}
                  }}
                  disabled={isRunning}
                  title="Browse folder"
                  className="px-3 py-2 bg-[#0d0f17] border border-[#2a2d3a] rounded-lg text-slate-400 hover:text-white hover:border-blue-500 transition-colors disabled:opacity-50"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Auto-SKU */}
            <div className="rounded-xl border border-[#2a2d3a] overflow-hidden">
              <div className="px-3.5 py-2.5 bg-white/[0.02] border-b border-[#2a2d3a] flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-purple-400" />
                <p className="text-xs font-semibold text-slate-300">
                  Auto-SKU Generation
                </p>
              </div>
              <div className="p-3.5 space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Auto-assign SKUs to products that have no SKU in the filename.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">
                      Prefix
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. FF"
                      value={skuPrefix}
                      onChange={(e) =>
                        setSkuPrefix(e.target.value.toUpperCase())
                      }
                      maxLength={6}
                      disabled={isRunning}
                      className="w-full bg-[#0d0f17] border border-[#2a2d3a] rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono disabled:opacity-50"
                    />
                  </div>
                  <div className="w-20">
                    <label className="text-xs text-slate-500 mb-1 block">
                      Start #
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={skuStart}
                      onChange={(e) =>
                        setSkuStart(Math.max(1, Number(e.target.value)))
                      }
                      disabled={isRunning}
                      className="w-full bg-[#0d0f17] border border-[#2a2d3a] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                    />
                  </div>
                </div>
                {autoSkuEnabled && (
                  <div className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 font-mono">
                    {skuPrefix}
                    {String(skuStart).padStart(3, "0")}, {skuPrefix}
                    {String(skuStart + 1).padStart(3, "0")}, {skuPrefix}
                    {String(skuStart + 2).padStart(3, "0")}...
                  </div>
                )}
                {autoSkuEnabled && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={forceSku}
                      onChange={e => setForceSku(e.target.checked)}
                      disabled={isRunning}
                      className="w-3.5 h-3.5 accent-purple-500"
                    />
                    <span className="text-xs text-slate-400">
                      Override existing SKUs <span className="text-slate-600">(force apply to all)</span>
                    </span>
                  </label>
                )}
                {forceSku && autoSkuEnabled && (
                  <div className="text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2.5 py-2">
                    All products will get new SKUs — existing ones will be replaced.
                  </div>
                )}
              </div>
            </div>

            {/* Scan */}
            <button
              onClick={handleScan}
              disabled={!folderPath.trim() || scanning || isRunning}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {scanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {scanning ? "Scanning..." : "Scan Folder"}
            </button>

            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {session?.state === "preview" && hasProducts && (
              <div className="space-y-2">
                <button
                  onClick={handleStart}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Start Upload ({session.total})
                </button>

                <button
                  onClick={() => { setShowCsvPanel(v => !v); setImgBaseUrl(siteUrl + '/wp-content/uploads') }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-[#2a2d3a] text-slate-300 text-sm font-medium rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  Export as CSV
                </button>

                {showCsvPanel && (
                  <div className="rounded-xl border border-[#2a2d3a] bg-[#0d0f17] p-3.5 space-y-3">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      CSV will be in WooCommerce import format. Images column needs a public URL prefix — where your images will be accessible on the web.
                    </p>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Image Base URL <span className="text-slate-600">(optional)</span></label>
                      <input
                        type="text"
                        value={imgBaseUrl}
                        onChange={e => setImgBaseUrl(e.target.value)}
                        placeholder="https://yoursite.com/wp-content/uploads"
                        className="w-full bg-[#12151f] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                    <a
                      href={`http://localhost:8000/bulk-upload/export-csv/${sessionId}?image_base_url=${encodeURIComponent(imgBaseUrl)}`}
                      download="woocommerce_products.csv"
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download CSV
                    </a>
                  </div>
                )}
              </div>
            )}

            {isRunning && (
              <button
                onClick={handleCancel}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg border border-red-500/20 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            )}

            {hasResults && !isRunning && (
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-400 hover:text-white text-sm rounded-lg hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            )}

            {/* Folder structure guide */}
            <div className="rounded-xl border border-[#2a2d3a] overflow-hidden">
              <div className="px-3.5 py-2.5 bg-white/[0.02] border-b border-[#2a2d3a]">
                <p className="text-xs font-semibold text-slate-300">
                  Folder Structure
                </p>
              </div>
              <div className="p-3.5">
                <div className="font-mono text-xs text-slate-400 leading-[1.7] bg-black/20 rounded-lg p-3">
                  <p>📁 D:\products\</p>
                  <p>&nbsp;&nbsp;📁 Hoodies\</p>
                  <p>&nbsp;&nbsp;&nbsp;&nbsp;📁 Fleece\</p>
                  <p>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <span className="text-green-400">
                      FF728_hoodie-black_2500.jpg
                    </span>
                  </p>
                  <p>&nbsp;&nbsp;📁 Gloves\</p>
                  <p>
                    &nbsp;&nbsp;&nbsp;&nbsp;
                    <span className="text-blue-400">
                      boxing-gloves_1200.jpg
                    </span>
                  </p>
                </div>
                <div className="mt-2.5 space-y-1 text-[10px] text-slate-500">
                  <p>
                    <span className="text-slate-400">Level 1 folder</span> →
                    Category
                  </p>
                  <p>
                    <span className="text-slate-400">Level 2 folder</span> →
                    Subcategory
                  </p>
                  <p>
                    <span className="text-slate-400">Level 3 folder</span> →
                    Sub-subcategory
                  </p>
                </div>
              </div>
            </div>

            {/* Filename guide */}
            <div className="rounded-xl border border-[#2a2d3a] overflow-hidden">
              <div className="px-3.5 py-2.5 bg-white/[0.02] border-b border-[#2a2d3a]">
                <p className="text-xs font-semibold text-slate-300">
                  Filename Format
                </p>
              </div>
              <div className="p-3.5 space-y-3">
                {[
                  {
                    file: "FF728_belt-black_2500.jpg",
                    label: "SKU + Name + Price",
                    output: { name: "Belt Black", sku: "FF728", price: "2500" },
                  },
                  {
                    file: "FF728_belt-black.jpg",
                    label: "SKU + Name",
                    output: { name: "Belt Black", sku: "FF728", price: "—" },
                  },
                  {
                    file: "belt-black_2500.jpg",
                    label: "Name + Price",
                    output: {
                      name: "Belt Black",
                      sku: "auto / —",
                      price: "2500",
                    },
                  },
                  {
                    file: "belt-black.jpg",
                    label: "Name only",
                    output: { name: "Belt Black", sku: "auto / —", price: "—" },
                  },
                ].map(({ file, label, output }) => (
                  <div key={file} className="space-y-1">
                    <code className="text-[10px] text-green-400 font-mono leading-tight block">
                      {file}
                    </code>
                    <p className="text-[10px] text-slate-600">{label}</p>
                    <div className="flex gap-3 text-[10px] bg-black/20 rounded px-2 py-1.5">
                      <span>
                        <span className="text-slate-500">Name:</span>{" "}
                        <span className="text-slate-300">{output.name}</span>
                      </span>
                      <span>
                        <span className="text-slate-500">SKU:</span>{" "}
                        <span className="text-purple-400">{output.sku}</span>
                      </span>
                      <span>
                        <span className="text-slate-500">Price:</span>{" "}
                        <span className="text-green-400">{output.price}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!hasResults && !scanning && (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 gap-3">
              <FolderInput className="w-12 h-12 opacity-30" />
              <p className="text-sm font-medium text-slate-500">
                Enter a folder path and click Scan
              </p>
              <p className="text-xs">
                Results and upload progress will appear here
              </p>
            </div>
          )}

          {scanning && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Scanning folder...</p>
            </div>
          )}

          {/* Interrupted session resume banner */}
          {incompleteSessions.length > 0 && !hasResults && (
            <div className="space-y-2">
              {incompleteSessions.map((inc) => {
                const mismatch = inc.site_url && inc.site_url.replace(/\/$/, '') !== siteUrl.replace(/\/$/, '')
                return (
                  <div key={inc.session_id} className={`rounded-xl border p-3.5 space-y-2 ${mismatch ? 'border-red-500/25 bg-red-500/5' : 'border-orange-500/25 bg-orange-500/5'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${mismatch ? 'text-red-300' : 'text-orange-300'}`}>
                          Interrupted upload found
                        </p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{inc.folder_path}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {inc.created} uploaded · {inc.pending} remaining
                        </p>
                      </div>
                      <button
                        onClick={() => handleResume(inc.session_id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium rounded-lg transition-colors shrink-0 ${mismatch ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-300' : 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/30 text-orange-300'}`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Resume
                      </button>
                    </div>
                    {mismatch && (
                      <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/10 rounded-lg px-2.5 py-2">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>
                          Warning: This session was for <span className="font-mono text-red-300">{inc.site_url}</span> but current site is <span className="font-mono text-red-300">{siteUrl}</span>. Resuming will upload to the current site.
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Stats */}
          {session && hasProducts && (
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: "Total", value: session.total, color: "text-white" },
                {
                  label: "Created",
                  value: session.created,
                  color: "text-green-400",
                },
                {
                  label: "Uploading",
                  value: session.uploading,
                  color: "text-blue-400",
                },
                {
                  label: "Pending",
                  value: session.pending,
                  color: "text-slate-400",
                },
                {
                  label: "Failed",
                  value: session.failed,
                  color: "text-red-400",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-[#12151f] border border-[#2a2d3a] rounded-xl p-3.5 text-center"
                >
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {session && !hasProducts && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              No images found in this folder. Check the path and folder
              structure.
            </div>
          )}

          {/* Product table */}
          {session && hasProducts && (
            <div className="bg-[#12151f] border border-[#2a2d3a] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2a2d3a] flex items-center justify-between">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  {session.state === "preview"
                    ? `Preview — ${session.total} products found`
                    : session.state === "running"
                      ? "Uploading to WooCommerce..."
                      : `Done — ${session.created} created`}
                  {isRunning && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  )}
                </p>
                {session.state === "preview" &&
                  autoSkuEnabled &&
                  noSkuCount === 0 && (
                    <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded font-medium">
                      Auto-SKU applied
                    </span>
                  )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#2a2d3a] text-slate-500">
                      <th className="text-left px-4 py-2.5 font-medium w-8"></th>
                      <th className="text-left px-2 py-2.5 font-medium w-12">
                        Image
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium">
                        Product
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium">
                        Category
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium">SKU</th>
                      <th className="text-left px-4 py-2.5 font-medium">
                        Price
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium">
                        Status
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium">
                        WC ID
                      </th>
                      {session.state === "preview" && <th className="w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {session.products.map((p, i) => (
                      <tr
                        key={i}
                        className={`border-b border-white/5 last:border-0 transition-colors
                          ${
                            p.status === "uploading"
                              ? "bg-blue-500/5"
                              : p.status === "failed"
                                ? "bg-red-500/5"
                                : p.status === "created"
                                  ? "bg-green-500/5"
                                  : ""
                          }`}
                      >
                        <td className="px-4 py-2.5">
                          <StatusIcon status={p.status} />
                        </td>
                        <td className="px-2 py-1.5">
                          <img
                            src={api.bulkImageUrl(sessionId!, p.file_path)}
                            alt={p.name}
                            className="w-12 h-12 object-cover rounded-lg border border-white/10 bg-white/5"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-white font-medium">{p.name}</p>
                          <p className="text-slate-600 font-mono text-[10px] truncate max-w-[180px]">
                            {p.filename}
                          </p>
                          {p.error && (
                            <p
                              className="text-red-400 text-[10px] mt-0.5 max-w-[220px] truncate"
                              title={p.error}
                            >
                              {p.error}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.category ? (
                            <p className="text-slate-300">{p.category}</p>
                          ) : (
                            <p className="text-slate-600 italic text-[11px]">
                              no category
                            </p>
                          )}
                          {p.subcategory && (
                            <p className="text-slate-500 text-[10px]">
                              ↳ {p.subcategory}
                            </p>
                          )}
                          {p.subsubcategory && (
                            <p className="text-slate-600 text-[10px]">
                              ↳↳ {p.subsubcategory}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.sku ? (
                            <span className="flex items-center gap-1">
                              <code className="text-purple-400 font-mono">
                                {p.sku}
                              </code>
                              {p.sku_auto && (
                                <span className="text-[9px] text-purple-500 bg-purple-500/10 px-1 rounded">
                                  auto
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.price != null ? (
                            <span className="text-green-400">${p.price}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          {p.wc_product_id ? (
                            <a
                              href={`${siteUrl}/wp-admin/post.php?post=${p.wc_product_id}&action=edit`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300 font-mono underline underline-offset-2"
                            >
                              #{p.wc_product_id}
                            </a>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        {session.state === "preview" && (
                          <td className="pr-3">
                            <button
                              onClick={() => handleRemoveProduct(i)}
                              className="p-1 text-slate-600 hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
                              title="Remove from list"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Done message */}
          {isDone && hasProducts && (
            <div
              className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between gap-2
              ${
                session!.failed === 0
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
              }`}
            >
              <span className="flex items-center gap-2">
                {session!.failed === 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> All{" "}
                    {session!.created} products uploaded to WooCommerce
                    successfully.
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 shrink-0" />{" "}
                    {session!.created} created, {session!.failed} failed — check
                    error details above.
                  </>
                )}
              </span>
              {session!.failed > 0 && (
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 text-xs font-medium rounded-lg transition-colors shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Failed ({session!.failed})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
