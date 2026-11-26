import { useMemo, useRef, useState } from 'react';
import {
  Download, Upload, RefreshCw, Plus, Trash2, CalendarDays, Clock, Info, House, Wind,
  TriangleAlert, Phone, Globe, Mail, Facebook, Instagram, Waves, FileInput,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import pemkoLogo from '../assets/pemko.png';
import majuLogo from '../assets/maju-sejahtera.png';
import bpbdLogo from '../assets/bpbd.png';
import logo500 from '../assets/500-crop.png';

// ---------------------------------------------------------------------------
// Tipe & util
// ---------------------------------------------------------------------------
interface TideRow {
  id: string;
  date: string;   // YYYY-MM-DD
  start: string;  // HH:MM
  end: string;    // HH:MM
  height: string; // meter, mis. "2.7"
}

const HARI = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const BULAN = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];

const uid = () => Math.random().toString(36).slice(2, 10);

const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtTime = (t: string) => (t || '').replace(':', '.');

const fmtHeight = (h: string) => {
  const n = parseFloat((h || '').replace(',', '.'));
  return isNaN(n) ? '-' : n.toFixed(1);
};

const buildPeriodLabel = (rows: TideRow[]) => {
  const dates = rows.map((r) => parseDate(r.date)).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return '-';
  const a = dates[0];
  const b = dates[dates.length - 1];
  if (a.getTime() === b.getTime()) return `${a.getDate()} ${BULAN[a.getMonth()]} ${a.getFullYear()}`;
  if (a.getFullYear() !== b.getFullYear())
    return `${a.getDate()} ${BULAN[a.getMonth()]} ${a.getFullYear()} - ${b.getDate()} ${BULAN[b.getMonth()]} ${b.getFullYear()}`;
  if (a.getMonth() !== b.getMonth())
    return `${a.getDate()} ${BULAN[a.getMonth()]} - ${b.getDate()} ${BULAN[b.getMonth()]} ${b.getFullYear()}`;
  return `${a.getDate()} - ${b.getDate()} ${BULAN[a.getMonth()]} ${a.getFullYear()}`;
};

// Data dummy: 4 hari mulai hari ini. Ganti dengan data harian resmi.
const makeDummyRows = (): TideRow[] => {
  const base = new Date();
  const sample = [
    { start: '09:00', end: '12:00', height: '2.7' },
    { start: '09:00', end: '13:00', height: '2.7' },
    { start: '10:00', end: '13:00', height: '2.6' },
    { start: '11:00', end: '12:00', height: '2.6' },
  ];
  return sample.map((s, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return { id: uid(), date: toIsoDate(d), ...s };
  });
};

/**
 * Import massal. Format yang diterima:
 * 1) CSV/TSV per baris: tanggal, jam_mulai, jam_selesai, tinggi
 *    contoh: 2025-07-01, 09:00, 12:00, 2.7   (tanggal juga boleh 01/07/2025)
 * 2) JSON array: [{"tanggal":"2025-07-01","mulai":"09:00","selesai":"12:00","tinggi":2.7}]
 */
const normalizeDate = (raw: string) => {
  const s = raw.trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};
const normalizeTime = (raw: string) => {
  const m = String(raw).trim().match(/^(\d{1,2})[:.](\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
};

const parseBulk = (text: string): { rows: TideRow[]; errors: string[] } => {
  const errors: string[] = [];
  const rows: TideRow[] = [];
  const t = text.trim();
  if (!t) return { rows, errors: ['Data kosong.'] };

  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t) as Record<string, unknown>[];
      arr.forEach((o, i) => {
        const date = normalizeDate(String(o.tanggal ?? o.date ?? ''));
        const start = normalizeTime(String(o.mulai ?? o.start ?? ''));
        const end = normalizeTime(String(o.selesai ?? o.end ?? ''));
        const height = String(o.tinggi ?? o.height ?? '').replace(',', '.');
        if (!date || !start || !end || isNaN(parseFloat(height))) errors.push(`Item ${i + 1} tidak valid.`);
        else rows.push({ id: uid(), date, start, end, height });
      });
    } catch {
      errors.push('JSON tidak valid.');
    }
    return { rows, errors };
  }

  t.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || /tanggal|date/i.test(line)) return; // lewati header
    // Tab/titik-koma diprioritaskan agar koma desimal (2,7) tidak ikut terpecah
    const delim = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    const parts = line.split(delim).map((p) => p.trim());
    if (parts.length < 4) { errors.push(`Baris ${i + 1}: kolom kurang (butuh 4).`); return; }
    const date = normalizeDate(parts[0]);
    const start = normalizeTime(parts[1]);
    const end = normalizeTime(parts[2]);
    const height = parts[3].replace(',', '.');
    if (!date || !start || !end || isNaN(parseFloat(height))) errors.push(`Baris ${i + 1}: format salah.`);
    else rows.push({ id: uid(), date, start, end, height });
  });
  return { rows, errors };
};

// Ikon papan duga (gauge) sederhana dengan panah naik
const GaugeIcon = ({ size = 44 }: { size?: number }) => (
  <svg width={size * 0.9} height={size} viewBox="0 0 40 44" fill="none">
    <path d="M7 34V8" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" />
    <path d="M2 13l5-6 5 6" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <rect x="18" y="3" width="11" height="33" rx="1.5" stroke="#0f2c59" strokeWidth="2" fill="#fff" />
    {[8, 12, 16, 20, 24, 28, 32].map((y, i) => (
      <path key={y} d={`M18 ${y}h${i % 2 === 0 ? 6 : 4}`} stroke="#0f2c59" strokeWidth="1.3" />
    ))}
    <path d="M14 39c3-2 5-2 8 0s5 2 8 0 5-2 8 0" stroke="#1d4ed8" strokeWidth="1.6" fill="none" />
  </svg>
);

const WaveLine = ({ width = 150, color = '#3b82f6' }: { width?: number; color?: string }) => (
  <svg width={width} height="8" viewBox={`0 0 ${width} 8`} fill="none">
    <path
      d={Array.from({ length: Math.ceil(width / 20) }, (_, i) => `${i === 0 ? 'M0 4' : ''} q5 -4 10 0 t10 0`).join(' ')}
      stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Komponen
// ---------------------------------------------------------------------------
const PREVIEW_W = 720;
const PREVIEW_H = 960;
const OUTPUT_W = 1080; // 1080 x 1440 (3:4)

const TidalFlood = () => {
  const [rows, setRows] = useState<TideRow[]>(makeDummyRows);
  const [isDummy, setIsDummy] = useState(true);
  const [periodOverride, setPeriodOverride] = useState('');

  const [orgLine1, setOrgLine1] = useState('BADAN PENANGGULANGAN BENCANA DAERAH');
  const [orgLine2, setOrgLine2] = useState('KOTA BANJARMASIN');
  const [description, setDescription] = useState(
    'Fenomena naiknya permukaan air laut yang dapat memengaruhi wilayah pesisir dan sungai.'
  );
  const [notes, setNotes] = useState([
    'Perkiraan ini menunjukkan pasang tertinggi yang biasanya terjadi sore hingga malam.',
    'Ketinggian diukur dari titik surut terendah (LAT) Muara Sungai Barito.',
    'Saat pasang purnama dan kondisi cuaca buruk (angin, hujan, tekanan udara rendah), air bisa naik lebih tinggi dari angka ini.',
  ]);
  const [contact, setContact] = useState({
    callCenter: '+62851-8689-1117',
    website: 'bpbd.banjarmasinkota.go.id',
    instagram: '@bpbd_kota_banjarmasin',
    facebook: 'bpbd.kota.banjarmasin',
    igShort: 'bpbd.banjarmasin',
    phone: '0853-4608-9588',
    email: 'bpbd.banjarmasin@gmail.com',
    web2: 'www.bpbd.banjarmasinkota.go.id',
  });

  const [logos, setLogos] = useState<(string | null)[]>([bpbdLogo, majuLogo, logo500, pemkoLogo]);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [bgFade, setBgFade] = useState(70);
  const [bulkText, setBulkText] = useState('');
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const logoInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
    [rows]
  );
  const periodLabel = periodOverride.trim() || buildPeriodLabel(sortedRows);

  // ---- handlers ----
  const readFile = (file: File, cb: (url: string) => void) => {
    const reader = new FileReader();
    reader.onload = (ev) => ev.target?.result && cb(ev.target.result as string);
    reader.readAsDataURL(file);
  };

  const updateRow = (id: string, patch: Partial<TideRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setIsDummy(false);
  };

  const addRow = () => {
    if (rows.length >= 7) return;
    const last = sortedRows[sortedRows.length - 1];
    const next = last ? parseDate(last.date) ?? new Date() : new Date();
    if (last) next.setDate(next.getDate() + 1);
    setRows((rs) => [...rs, { id: uid(), date: toIsoDate(next), start: '09:00', end: '12:00', height: '2.5' }]);
    setIsDummy(false);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  const applyBulk = () => {
    const { rows: parsed, errors } = parseBulk(bulkText);
    if (!parsed.length) {
      setBulkMsg({ ok: false, text: errors.join(' ') || 'Tidak ada baris valid.' });
      return;
    }
    const limited = parsed.slice(0, 7);
    setRows(limited);
    setIsDummy(false);
    setPeriodOverride('');
    const extra = parsed.length > 7 ? ` (${parsed.length - 7} baris diabaikan, maks 7 hari)` : '';
    setBulkMsg({
      ok: errors.length === 0,
      text: `${limited.length} baris dimuat${extra}.${errors.length ? ' Peringatan: ' + errors.join(' ') : ''}`,
    });
  };

  const resetDummy = () => {
    setRows(makeDummyRows());
    setIsDummy(true);
    setPeriodOverride('');
    setBulkMsg(null);
  };

  const downloadImage = async () => {
    if (!previewRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(previewRef.current, {
        pixelRatio: OUTPUT_W / PREVIEW_W,
        cacheBust: true,
        width: PREVIEW_W,
        height: PREVIEW_H,
        style: { borderRadius: '0', border: 'none', boxShadow: 'none', margin: '0', transform: 'none' },
      });
      const link = document.createElement('a');
      link.download = `pasang-rob-banjarmasin-${sortedRows[0]?.date || toIsoDate(new Date())}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
      alert('Gagal mengunduh gambar. Silakan coba lagi.');
    } finally {
      setIsDownloading(false);
    }
  };

  const goTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // ---- layout dinamis tabel ----
  const n = sortedRows.length;
  const rowH = Math.min(80, Math.floor((306 - (n - 1) * 4) / n)); // tinggi area baris 306px
  const big = rowH >= 62;

  const inputCls = 'w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none';

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 to-blue-200 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* ================= FORM ================= */}
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left w-full md:w-auto">
              <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                <h1 className="text-xl md:text-3xl font-bold text-gray-800">Generator Pasang Surut / Air Rob</h1>
                {isDummy && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded">Data Dummy</span>}
              </div>
              <p className="text-gray-600 mt-1 text-sm md:text-base">Jadwal perkiraan pasang tertinggi Kota Banjarmasin</p>
            </div>
            <div className="flex flex-wrap w-full md:w-auto justify-center gap-2 sm:gap-3">
              <button onClick={() => goTo('/')} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium">
                ← Cuaca
              </button>
              <button onClick={() => goTo('/udara')} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium">
                ISPU
              </button>
              <button onClick={() => bgInputRef.current?.click()} className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs sm:text-sm font-medium">
                <Upload className="w-4 h-4" /> Background
              </button>
              <button onClick={resetDummy} className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-medium">
                <RefreshCw className="w-4 h-4" /> Reset Dummy
              </button>
              <button onClick={downloadImage} disabled={isDownloading} className="w-full sm:w-auto flex justify-center items-center gap-1.5 px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-wait text-white rounded-lg text-xs sm:text-sm font-medium">
                {isDownloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isDownloading ? 'Mengunduh...' : 'Download PNG'}
              </button>
            </div>
          </div>

          {/* Tabel data */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-gray-800">🌊 Data Pasang (maks 7 hari)</h3>
              <button onClick={addRow} disabled={rows.length >= 7} className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-md flex items-center gap-1">
                <Plus className="w-3 h-3" /> Tambah Hari
              </button>
            </div>
            <div className="space-y-2">
              {sortedRows.map((r) => {
                const d = parseDate(r.date);
                return (
                  <div key={r.id} className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 items-end bg-gray-50 rounded-lg p-2">
                    <label className="col-span-2 sm:col-span-1 text-xs text-gray-600">
                      Tanggal {d && <span className="font-semibold text-gray-800">({HARI[d.getDay()]})</span>}
                      <input type="date" value={r.date} onChange={(e) => updateRow(r.id, { date: e.target.value })} className={inputCls} />
                    </label>
                    <label className="text-xs text-gray-600">Jam mulai
                      <input type="time" value={r.start} onChange={(e) => updateRow(r.id, { start: e.target.value })} className={inputCls} />
                    </label>
                    <label className="text-xs text-gray-600">Jam selesai
                      <input type="time" value={r.end} onChange={(e) => updateRow(r.id, { end: e.target.value })} className={inputCls} />
                    </label>
                    <label className="text-xs text-gray-600">Tinggi maks (m)
                      <input type="number" step="0.1" min="0" value={r.height} onChange={(e) => updateRow(r.id, { height: e.target.value })} className={inputCls} />
                    </label>
                    <button onClick={() => removeRow(r.id)} disabled={rows.length <= 1} title="Hapus" className="h-[38px] px-3 bg-red-500 hover:bg-red-600 disabled:opacity-30 text-white rounded-lg flex items-center justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <label className="block mt-3 text-xs text-gray-600">
              Label periode (kosongkan = otomatis: <span className="font-semibold">{buildPeriodLabel(sortedRows)}</span>)
              <input value={periodOverride} onChange={(e) => setPeriodOverride(e.target.value)} className={inputCls} placeholder="mis. 1 - 4 JULI 2025" />
            </label>
          </div>

          {/* Import massal */}
          <details className="mt-4 pt-4 border-t border-gray-200">
            <summary className="text-sm font-bold text-gray-800 cursor-pointer flex items-center gap-1.5">
              <FileInput className="w-4 h-4" /> Import Data Harian (CSV / JSON)
            </summary>
            <p className="text-xs text-gray-500 mt-2">
              Satu baris per hari: <code className="bg-gray-100 px-1 rounded">tanggal, jam_mulai, jam_selesai, tinggi</code>. Tanggal format
              <code className="bg-gray-100 px-1 rounded">2025-07-01</code> atau <code className="bg-gray-100 px-1 rounded">01/07/2025</code>. Bisa juga paste langsung dari Excel (tab).
            </p>
            <textarea
              rows={5}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className={`${inputCls} mt-2 font-mono text-xs`}
              placeholder={'2025-07-01, 09:00, 12:00, 2.7\n2025-07-02, 09:00, 13:00, 2.7\n2025-07-03, 10:00, 13:00, 2.6\n2025-07-04, 11:00, 12:00, 2.6'}
            />
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <button onClick={applyBulk} className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md">Terapkan</button>
              {bulkMsg && <span className={`text-xs ${bulkMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{bulkMsg.text}</span>}
            </div>
          </details>

          {/* Teks */}
          <details className="mt-4 pt-4 border-t border-gray-200">
            <summary className="text-sm font-bold text-gray-800 cursor-pointer">✏️ Edit Teks & Catatan</summary>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <label className="text-xs text-gray-600">Nama instansi (baris 1)
                <input value={orgLine1} onChange={(e) => setOrgLine1(e.target.value)} className={inputCls} />
              </label>
              <label className="text-xs text-gray-600">Nama instansi (baris 2)
                <input value={orgLine2} onChange={(e) => setOrgLine2(e.target.value)} className={inputCls} />
              </label>
              <label className="sm:col-span-2 text-xs text-gray-600">Deskripsi Air Rob
                <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
              </label>
              {notes.map((t, i) => (
                <label key={i} className="text-xs text-gray-600">Catatan {i + 1}
                  <textarea rows={3} value={t} onChange={(e) => setNotes((ns) => ns.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
                </label>
              ))}
            </div>
          </details>

          <details className="mt-4 pt-4 border-t border-gray-200">
            <summary className="text-sm font-bold text-gray-800 cursor-pointer">📞 Edit Kontak</summary>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              {([
                ['callCenter', 'Call Center Pusdalops-PB'], ['website', 'Website (footer)'], ['instagram', 'Instagram (footer)'],
                ['facebook', 'Facebook'], ['igShort', 'Instagram (bawah)'], ['phone', 'Telepon/WA'], ['email', 'Email'], ['web2', 'Website (bawah)'],
              ] as [keyof typeof contact, string][]).map(([k, label]) => (
                <label key={k} className="text-xs text-gray-600">{label}
                  <input value={contact[k]} onChange={(e) => setContact((c) => ({ ...c, [k]: e.target.value }))} className={inputCls} />
                </label>
              ))}
            </div>
          </details>

          {/* Logo & background */}
          <details className="mt-4 pt-4 border-t border-gray-200">
            <summary className="text-sm font-bold text-gray-800 cursor-pointer">📸 Logo & Background</summary>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              {['Logo BPBD', 'Logo Tagline', 'Logo Event', 'Logo Pemko'].map((label, i) => (
                <div key={i}>
                  <div onClick={() => logoInputRefs.current[i]?.click()} className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-3 flex flex-col items-center justify-center h-24 bg-gray-50">
                    {logos[i] ? <img src={logos[i]!} alt={label} className="max-w-16 max-h-12 object-contain" /> : <div className="w-12 h-12 rounded-full bg-gray-300" />}
                    <span className="text-xs text-gray-600 mt-1">{label}</span>
                  </div>
                  <input
                    ref={(el) => { logoInputRefs.current[i] = el; }}
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, (u) => setLogos((ls) => ls.map((x, j) => (j === i ? u : x)))); }}
                  />
                </div>
              ))}
            </div>
            {backgroundImage && (
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <label className="text-sm text-gray-700">Kecerahan overlay:</label>
                <input type="range" min={0} max={95} value={bgFade} onChange={(e) => setBgFade(Number(e.target.value))} className="w-40 accent-blue-600" />
                <span className="text-sm text-gray-600">{bgFade}%</span>
                <button onClick={() => setBackgroundImage(null)} className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-md">Hapus background</button>
              </div>
            )}
          </details>

          <input ref={bgInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, setBackgroundImage); }} />
        </div>

        {/* ================= PREVIEW (720x960 → 1080x1440) ================= */}
        <div className="w-full overflow-x-auto pb-8">
          <div
            ref={previewRef}
            className="relative rounded-xl shadow-2xl overflow-hidden mx-auto border border-gray-300 select-none"
            style={{
              minWidth: PREVIEW_W, maxWidth: PREVIEW_W, height: PREVIEW_H,
              ...(backgroundImage
                ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { backgroundImage: 'linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 35%, #bae6fd 70%, #1d6fd1 100%)' }),
            }}
          >
            {/* overlay & dekorasi */}
            {backgroundImage ? (
              <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(255,255,255,${bgFade / 100}) 0%, rgba(255,255,255,${(bgFade / 100) * 0.6}) 60%, rgba(255,255,255,${(bgFade / 100) * 0.3}) 100%)` }} />
            ) : (
              <svg className="absolute inset-0" width={PREVIEW_W} height={PREVIEW_H} viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} preserveAspectRatio="none">
                <path d="M0 120 C 160 60, 300 170, 470 110 S 680 70, 720 100 L720 0 L0 0Z" fill="#7dd3fc" opacity="0.35" />
                <path d="M0 150 C 180 90, 320 200, 500 140 S 690 110, 720 130 L720 0 L0 0Z" fill="#38bdf8" opacity="0.18" />
                <path d="M0 820 C 150 760, 320 860, 500 800 S 680 760, 720 790 L720 960 L0 960Z" fill="#2563eb" opacity="0.35" />
                <path d="M0 860 C 170 810, 330 900, 520 850 S 690 820, 720 840 L720 960 L0 960Z" fill="#1e40af" opacity="0.4" />
              </svg>
            )}

            <div className="relative z-10 h-full flex flex-col px-[22px] pt-[14px] pb-[8px] text-slate-900">
              {/* HEADER LOGO BAR */}
              <div className="bg-[#0b1f4d] rounded-[22px] h-[70px] flex items-center justify-between px-3 shadow-lg">
                <img src={logos[0] || bpbdLogo} className="h-[58px] w-[58px] object-contain" alt="BPBD" />
                <div className="h-[50px] w-[176px] rounded-sm border border-sky-400/60 bg-gradient-to-br from-[#0b1f4d] via-[#123a7a] to-[#0b1f4d] flex flex-col justify-center px-2">
                  <span className="text-[10px] font-semibold tracking-wide text-red-400 leading-none" style={{ fontFamily: 'Georgia, serif' }}>CITY OF A</span>
                  <span className="text-[15px] font-semibold text-sky-100 leading-none mt-0.5 whitespace-nowrap" style={{ fontFamily: 'Georgia, serif' }}>THOUSAND RIVERS</span>
                </div>
                <img src={logos[1] || majuLogo} className="h-[46px] w-[120px] object-contain" alt="Maju Sejahtera" />
                <img src={logos[2] || logo500} className="h-[46px] w-[116px] object-contain" alt="500 Tahun" />
                <img src={logos[3] || pemkoLogo} className="h-[56px] w-[48px] object-contain" alt="Pemko" />
              </div>

              {/* NAMA INSTANSI */}
              <div className="text-center mt-[12px] text-[#0b1f4d] font-black leading-tight text-[16px] tracking-wide">
                <div>{orgLine1}</div>
                <div>{orgLine2}</div>
              </div>

              {/* JUDUL + KARTU AIR ROB */}
              <div className="flex justify-between mt-[10px]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <div className="w-[48px] h-[48px] rounded-full bg-orange-500 flex items-center justify-center shadow z-10 border-[3px] border-white">
                      <CalendarDays className="w-6 h-6 text-white" />
                    </div>
                    <div className="-ml-3 pl-6 pr-6 h-[34px] bg-[#0b1f4d] rounded-r-full flex items-center">
                      <span className="text-white font-black text-[21px] tracking-wide">JADWAL PERKIRAAN</span>
                    </div>
                  </div>
                  <div className="font-black text-[#0b1f4d] text-[60px] leading-[0.95] tracking-tight mt-[6px] whitespace-nowrap">PASANG SURUT</div>
                  <div className="font-black text-orange-500 text-[74px] leading-[0.95] tracking-tight">AIR ROB</div>
                  <div className="inline-block mt-[6px] bg-gradient-to-r from-amber-300 to-yellow-400 rounded-full px-6 py-1 shadow">
                    <span className="font-black text-[#0b1f4d] text-[22px] tracking-wide whitespace-nowrap">{periodLabel}</span>
                  </div>
                </div>
                <div className="w-[176px] h-[190px] bg-white/95 rounded-2xl shadow-lg p-3 flex flex-col flex-shrink-0 mt-[10px]">
                  <div className="flex items-center gap-1.5">
                    <Waves className="w-6 h-6 text-blue-600" />
                    <span className="font-black text-blue-700 text-[20px] leading-none">AIR ROB</span>
                  </div>
                  <p className="text-[12.5px] text-slate-800 font-medium leading-snug mt-2 flex-1">{description}</p>
                  <div className="self-end"><Waves className="w-9 h-9 text-blue-500" strokeWidth={1.5} /></div>
                </div>
              </div>

              {/* TABEL */}
              <div className="mt-[12px] bg-white/95 rounded-2xl shadow-xl p-2.5 flex flex-col">
                <div className="bg-[#0b1f4d] rounded-xl h-[34px] grid grid-cols-[150px_1fr_220px] items-center text-white font-black text-[15px] tracking-wide">
                  <div className="text-center">TANGGAL</div>
                  <div className="flex items-center justify-center gap-1.5 border-x border-white/20"><Clock className="w-4 h-4" /> JAM PUNCAK</div>
                  <div className="text-center">KETINGGIAN MAKS</div>
                </div>
                <div className="flex flex-col gap-[4px] mt-[5px]" style={{ height: 306 }}>
                  {sortedRows.map((r) => {
                    const d = parseDate(r.date);
                    return (
                      <div key={r.id} className="grid grid-cols-[150px_1fr_220px] items-center bg-white rounded-xl border border-slate-200 border-l-[5px] border-l-orange-500 shadow-sm" style={{ height: rowH }}>
                        <div className="flex items-center gap-2 pl-3">
                          <div className="w-[32px] h-[32px] rounded-md border-2 border-orange-500 flex items-center justify-center flex-shrink-0">
                            <CalendarDays className="w-5 h-5 text-orange-500" />
                          </div>
                          {big ? (
                            <div className="flex-1 text-center leading-none">
                              <div className="font-black text-[#0b1f4d] text-[12px]">{d ? HARI[d.getDay()] : '-'}</div>
                              <div className="font-black text-[#0b1f4d] text-[34px] leading-[1]">{d ? d.getDate() : '-'}</div>
                              <div className="font-black text-[#0b1f4d] text-[12px]">{d ? BULAN[d.getMonth()] : ''}</div>
                            </div>
                          ) : (
                            <div className="flex-1 text-center leading-none">
                              <div className="font-black text-[#0b1f4d] text-[10px]">{d ? HARI[d.getDay()] : '-'}</div>
                              <div className="font-black text-[#0b1f4d] whitespace-nowrap mt-[2px]">
                                <span className="text-[20px]">{d ? d.getDate() : '-'}</span>{' '}
                                <span className="text-[10px]">{d ? BULAN[d.getMonth()].slice(0, 3) : ''}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-center justify-center border-x border-slate-200 h-[70%]">
                          <div className={`font-black text-[#0b1f4d] ${big ? 'text-[24px]' : 'text-[19px]'} leading-none whitespace-nowrap`}>
                            {fmtTime(r.start)} – {fmtTime(r.end)} <span className={big ? 'text-[15px]' : 'text-[12px]'}>WITA</span>
                          </div>
                          {big && <div className="mt-1.5"><WaveLine width={150} /></div>}
                        </div>
                        <div className="flex items-center justify-between pl-3 pr-2">
                          <div className="leading-none">
                            <div className="flex items-baseline text-orange-500 font-black">
                              <span className={big ? 'text-[22px]' : 'text-[17px]'}>±</span>
                              <span className={big ? 'text-[44px]' : 'text-[30px]'}>{fmtHeight(r.height)}</span>
                            </div>
                            <div className="flex items-end gap-2">
                              <span className={`text-orange-500 font-black ${big ? 'text-[15px]' : 'text-[12px]'}`}>METER</span>
                              <span className="text-[7px] font-black text-[#0b1f4d] pb-[1px] whitespace-nowrap">TITIK TERENDAH (LAT)</span>
                            </div>
                          </div>
                          <GaugeIcon size={big ? 46 : 34} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CATATAN */}
                <div className="mt-[8px] bg-sky-50 rounded-xl px-3 py-2 border border-sky-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-700 flex items-center justify-center"><Info className="w-3.5 h-3.5 text-white" /></div>
                    <span className="font-black text-blue-700 text-[14px] tracking-wide">CATATAN PENTING</span>
                  </div>
                  <div className="grid grid-cols-3 mt-1.5">
                    {[House, Wind, TriangleAlert].map((Icon, i) => (
                      <div key={i} className={`flex items-start gap-2 px-2 ${i > 0 ? 'border-l border-slate-300' : ''}`}>
                        <Icon className={`w-8 h-8 flex-shrink-0 ${i === 2 ? 'text-amber-500' : 'text-[#0b1f4d]'}`} strokeWidth={1.8} />
                        <p className="text-[9.5px] leading-snug text-slate-800 font-medium">{notes[i]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="mt-auto">
                <div className="bg-[#0b1f4d] rounded-2xl h-[82px] grid grid-cols-[1.25fr_1fr_1.2fr] items-center px-3 text-white shadow-lg">
                  <div className="flex items-center gap-2">
                    <img src={logos[0] || bpbdLogo} className="w-[52px] h-[52px] object-contain" alt="BPBD" />
                    <div className="leading-tight">
                      <div className="font-black text-[11px]">Layanan Darurat Bencana</div>
                      <div className="font-black text-[11px]">Kota Banjarmasin</div>
                      <div className="text-[9px] opacity-90">Call Center Pusdalops-PB:</div>
                      <div className="font-black text-[13px] text-amber-300">{contact.callCenter}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center border-x border-white/20">
                    <div className="bg-white rounded-2xl px-3 py-1 flex items-center gap-1.5">
                      <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center"><Phone className="w-4 h-4 text-white" /></div>
                      <div className="leading-none text-center">
                        <div className="font-black text-red-600 text-[30px] leading-none">112</div>
                        <div className="text-[7px] font-black text-blue-800">BANJARMASIN SIAGA</div>
                      </div>
                    </div>
                    <div className="text-[9px] mt-1 opacity-90">Gratis, Bebas Pulsa, 24 Jam</div>
                  </div>
                  <div className="flex items-start gap-2 pl-3">
                    <Globe className="w-7 h-7 flex-shrink-0" strokeWidth={1.6} />
                    <div className="leading-tight min-w-0">
                      <div className="font-black text-[11px]">PANTAU INFORMASI TERKINI</div>
                      <div className="text-[10px] opacity-90 truncate">{contact.website}</div>
                      <div className="text-[10px] opacity-90 truncate">{contact.instagram}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 text-[8.5px] font-semibold text-white mt-[5px] whitespace-nowrap">
                  <span className="flex items-center gap-0.5"><Facebook className="w-3 h-3" />{contact.facebook}</span><span>|</span>
                  <span className="flex items-center gap-0.5"><Instagram className="w-3 h-3" />{contact.igShort}</span><span>|</span>
                  <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{contact.phone}</span><span>|</span>
                  <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" />{contact.email}</span><span>|</span>
                  <span className="flex items-center gap-0.5"><Globe className="w-3 h-3" />{contact.web2}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-600 text-center -mt-4 pb-6">
          Pratinjau 720×960 px · hasil unduhan 1080×1440 px (rasio 3:4). Pastikan data berasal dari sumber resmi sebelum dipublikasikan.
        </p>
      </div>
    </div>
  );
};

export default TidalFlood;
