import { useMemo, useRef, useState } from 'react';
import {
  Download, Upload, RefreshCw, Plus, Trash2, CalendarDays, Clock, Info, House, Wind,
  TriangleAlert, Phone, Globe, Mail, Facebook, Instagram, Waves, FileInput,
} from 'lucide-react';
import {
  DEFAULT_OVERLAY, makeLogos, readFileAsDataUrl, useTextFields,
  type LogoItem, type OverlaySettings, type TextDef,
} from '../lib/customize';
import { LogoManager, OverlayEditor, OverlayLayer, Section, TextFieldsEditor } from './shared/Customize';
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
// Definisi teks yang bisa diedit (isi, warna, ukuran)
// ---------------------------------------------------------------------------
const NAVY = '#0b1f4d';
const ORANGE = '#f97316';

const TEXT_DEFS: TextDef[] = [
  { key: 'org1', group: 'Header', label: 'Nama instansi baris 1', text: 'BADAN PENANGGULANGAN BENCANA DAERAH', color: NAVY, size: 16 },
  { key: 'org2', group: 'Header', label: 'Nama instansi baris 2', text: 'KOTA BANJARMASIN', color: NAVY, size: 16 },
  { key: 'badge1', group: 'Header', label: 'Badge teks baris 1', text: 'CITY OF A', color: '#f87171', size: 10 },
  { key: 'badge2', group: 'Header', label: 'Badge teks baris 2', text: 'THOUSAND RIVERS', color: '#e0f2fe', size: 15 },

  { key: 'pill', group: 'Judul', label: 'Label pil', text: 'JADWAL PERKIRAAN', color: '#ffffff', size: 21 },
  { key: 'title1', group: 'Judul', label: 'Judul baris 1', text: 'PASANG SURUT', color: NAVY, size: 60 },
  { key: 'title2', group: 'Judul', label: 'Judul baris 2', text: 'AIR ROB', color: ORANGE, size: 74 },
  { key: 'period', group: 'Judul', label: 'Periode tanggal (isi diatur di Data Pasang)', color: NAVY, size: 22 },
  { key: 'cardTitle', group: 'Judul', label: 'Kartu info: judul', text: 'AIR ROB', color: '#1d4ed8', size: 20 },
  { key: 'cardDesc', group: 'Judul', label: 'Kartu info: deskripsi', text: 'Fenomena naiknya permukaan air laut yang dapat memengaruhi wilayah pesisir dan sungai.', multiline: true, color: '#1e293b', size: 12.5 },

  { key: 'th1', group: 'Tabel', label: 'Kepala kolom 1', text: 'TANGGAL', color: '#ffffff', size: 15 },
  { key: 'th2', group: 'Tabel', label: 'Kepala kolom 2', text: 'JAM PUNCAK', color: '#ffffff', size: 15 },
  { key: 'th3', group: 'Tabel', label: 'Kepala kolom 3', text: 'KETINGGIAN MAKS', color: '#ffffff', size: 15 },
  { key: 'rDay', group: 'Tabel', label: 'Nama hari', color: NAVY, size: 12 },
  { key: 'rDate', group: 'Tabel', label: 'Angka tanggal', color: NAVY, size: 34 },
  { key: 'rMonth', group: 'Tabel', label: 'Nama bulan', color: NAVY, size: 12 },
  { key: 'rTime', group: 'Tabel', label: 'Jam puncak', color: NAVY, size: 24 },
  { key: 'rZone', group: 'Tabel', label: 'Zona waktu', text: 'WITA', color: NAVY, size: 15 },
  { key: 'rHeight', group: 'Tabel', label: 'Angka ketinggian', color: ORANGE, size: 44 },
  { key: 'rUnit', group: 'Tabel', label: 'Satuan', text: 'METER', color: ORANGE, size: 15 },
  { key: 'rRef', group: 'Tabel', label: 'Keterangan acuan', text: 'TITIK TERENDAH (LAT)', color: NAVY, size: 7 },

  { key: 'noteTitle', group: 'Catatan', label: 'Judul catatan', text: 'CATATAN PENTING', color: '#1d4ed8', size: 14 },
  { key: 'note1', group: 'Catatan', label: 'Catatan 1', text: 'Perkiraan ini menunjukkan pasang tertinggi yang biasanya terjadi sore hingga malam.', multiline: true, color: '#1e293b', size: 9.5 },
  { key: 'note2', group: 'Catatan', label: 'Catatan 2', text: 'Ketinggian diukur dari titik surut terendah (LAT) Muara Sungai Barito.', multiline: true, color: '#1e293b', size: 9.5 },
  { key: 'note3', group: 'Catatan', label: 'Catatan 3', text: 'Saat pasang purnama dan kondisi cuaca buruk (angin, hujan, tekanan udara rendah), air bisa naik lebih tinggi dari angka ini.', multiline: true, color: '#1e293b', size: 9.5 },

  { key: 'fTitle1', group: 'Footer & Kontak', label: 'Layanan baris 1', text: 'Layanan Darurat Bencana', color: '#ffffff', size: 11 },
  { key: 'fTitle2', group: 'Footer & Kontak', label: 'Layanan baris 2', text: 'Kota Banjarmasin', color: '#ffffff', size: 11 },
  { key: 'fCcLabel', group: 'Footer & Kontak', label: 'Label call center', text: 'Call Center Pusdalops-PB:', color: '#ffffff', size: 9 },
  { key: 'fCc', group: 'Footer & Kontak', label: 'Nomor call center', text: '+62851-8689-1117', color: '#fcd34d', size: 13 },
  { key: 'f112', group: 'Footer & Kontak', label: 'Nomor darurat', text: '112', color: '#dc2626', size: 30 },
  { key: 'f112Sub', group: 'Footer & Kontak', label: 'Label nomor darurat', text: 'BANJARMASIN SIAGA', color: '#1e40af', size: 7 },
  { key: 'f112Note', group: 'Footer & Kontak', label: 'Keterangan nomor darurat', text: 'Gratis, Bebas Pulsa, 24 Jam', color: '#ffffff', size: 9 },
  { key: 'fInfoTitle', group: 'Footer & Kontak', label: 'Judul info', text: 'PANTAU INFORMASI TERKINI', color: '#ffffff', size: 11 },
  { key: 'fInfo1', group: 'Footer & Kontak', label: 'Info baris 1', text: 'bpbd.banjarmasinkota.go.id', color: '#ffffff', size: 10 },
  { key: 'fInfo2', group: 'Footer & Kontak', label: 'Info baris 2', text: '@bpbd_kota_banjarmasin', color: '#ffffff', size: 10 },
  { key: 'strip', group: 'Footer & Kontak', label: 'Baris kontak bawah (warna & ukuran semua item)', color: '#ffffff', size: 8.5 },
  { key: 'sFb', group: 'Footer & Kontak', label: 'Facebook', text: 'bpbd.kota.banjarmasin' },
  { key: 'sIg', group: 'Footer & Kontak', label: 'Instagram', text: 'bpbd.banjarmasin' },
  { key: 'sPhone', group: 'Footer & Kontak', label: 'Telepon/WA', text: '0853-4608-9588' },
  { key: 'sMail', group: 'Footer & Kontak', label: 'Email', text: 'bpbd.banjarmasin@gmail.com' },
  { key: 'sWeb', group: 'Footer & Kontak', label: 'Website', text: 'www.bpbd.banjarmasinkota.go.id' },
];

// ---------------------------------------------------------------------------
// Komponen
// ---------------------------------------------------------------------------
const PREVIEW_W = 720;
const PREVIEW_H = 960;
const OUTPUT_W = 1080; // 1080 x 1440 (3:4)
const DEFAULT_LOGOS = [bpbdLogo, majuLogo, logo500, pemkoLogo];

const TidalFlood = () => {
  const [rows, setRows] = useState<TideRow[]>(makeDummyRows);
  const [isDummy, setIsDummy] = useState(true);
  const [periodOverride, setPeriodOverride] = useState('');
  const tf = useTextFields(TEXT_DEFS);
  const { t, s } = tf;

  const [logos, setLogos] = useState<LogoItem[]>(() => makeLogos(DEFAULT_LOGOS));
  const [logoSize, setLogoSize] = useState(54);
  const [showBadge, setShowBadge] = useState(true);
  const [badgePos, setBadgePos] = useState(1);
  const [footerLogo, setFooterLogo] = useState<string | null>(bpbdLogo);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlaySettings>({ ...DEFAULT_OVERLAY, angle: 90, color1: '#ffffff', opacity1: 70, color2: '#ffffff', opacity2: 20 });
  const [bulkText, setBulkText] = useState('');
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const footerLogoRef = useRef<HTMLInputElement>(null);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
    [rows]
  );
  const periodLabel = periodOverride.trim() || buildPeriodLabel(sortedRows);

  // ---- handlers ----
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

  const onBackground = async (file?: File) => {
    if (!file) return;
    setBackgroundImage(await readFileAsDataUrl(file));
    setOverlay((o) => ({ ...o, enabled: true }));
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

  // item header (logo + badge teks opsional)
  type HeaderItem = { kind: 'logo'; logo: LogoItem } | { kind: 'badge' };
  const headerItems: HeaderItem[] = logos.map((logo) => ({ kind: 'logo', logo }));
  if (showBadge) headerItems.splice(Math.min(badgePos, headerItems.length), 0, { kind: 'badge' });
  const logoMaxW = headerItems.length ? Math.floor((PREVIEW_W - 44 - 24 - (headerItems.length - 1) * 8) / headerItems.length) : 0;

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

          <Section title={<><FileInput className="w-4 h-4" /> Import Data Harian (CSV / JSON)</>}>
            <p className="text-xs text-gray-500">
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
          </Section>

          <Section title="✏️ Teks, Kontak & Footer (isi, warna, ukuran font)">
            <TextFieldsEditor fields={tf} />
          </Section>

          <Section title="📸 Logo">
            <LogoManager logos={logos} onChange={setLogos} defaults={DEFAULT_LOGOS} size={logoSize} onSizeChange={setLogoSize} sizeMin={28} sizeMax={62} />
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showBadge} onChange={(e) => setShowBadge(e.target.checked)} className="w-4 h-4" />
                Tampilkan badge teks "{t('badge1')} {t('badge2')}"
              </label>
              {showBadge && (
                <label className="flex items-center gap-2 text-xs">
                  Posisi badge
                  <input type="number" min={1} max={logos.length + 1} value={Math.min(badgePos, logos.length) + 1} onChange={(e) => setBadgePos(Math.max(0, Number(e.target.value) - 1))} className="w-14 p-1 border border-gray-300 rounded" />
                </label>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-700">Logo footer:</span>
              <div onClick={() => footerLogoRef.current?.click()} className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg w-16 h-16 flex items-center justify-center bg-gray-50">
                {footerLogo ? <img src={footerLogo} alt="Logo footer" className="max-w-12 max-h-12 object-contain" /> : <Plus className="w-5 h-5 text-gray-400" />}
              </div>
              {footerLogo && <button onClick={() => setFooterLogo(null)} className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md">Hapus</button>}
              <input ref={footerLogoRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFooterLogo(await readFileAsDataUrl(f)); e.target.value = ''; }} />
            </div>
          </Section>

          <Section title="🎨 Background & Overlay">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button onClick={() => bgInputRef.current?.click()} className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md">Upload background</button>
              {backgroundImage && <button onClick={() => setBackgroundImage(null)} className="text-xs px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-md">Hapus background</button>}
            </div>
            <OverlayEditor value={overlay} onChange={setOverlay} />
          </Section>

          <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onBackground(e.target.files?.[0]); e.target.value = ''; }} />
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
            {!backgroundImage && (
              <svg className="absolute inset-0" width={PREVIEW_W} height={PREVIEW_H} viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} preserveAspectRatio="none">
                <path d="M0 120 C 160 60, 300 170, 470 110 S 680 70, 720 100 L720 0 L0 0Z" fill="#7dd3fc" opacity="0.35" />
                <path d="M0 150 C 180 90, 320 200, 500 140 S 690 110, 720 130 L720 0 L0 0Z" fill="#38bdf8" opacity="0.18" />
                <path d="M0 820 C 150 760, 320 860, 500 800 S 680 760, 720 790 L720 960 L0 960Z" fill="#2563eb" opacity="0.35" />
                <path d="M0 860 C 170 810, 330 900, 520 850 S 690 820, 720 840 L720 960 L0 960Z" fill="#1e40af" opacity="0.4" />
              </svg>
            )}
            <OverlayLayer value={overlay} />

            <div className="relative z-10 h-full flex flex-col px-[22px] pt-[14px] pb-[8px] text-slate-900">
              {/* HEADER LOGO BAR */}
              {headerItems.length > 0 && (
                <div className="bg-[#0b1f4d] rounded-[22px] h-[70px] flex items-center justify-evenly gap-2 px-3 shadow-lg">
                  {headerItems.map((it, i) =>
                    it.kind === 'logo' ? (
                      <img key={it.logo.id} src={it.logo.src} alt={`Logo ${i + 1}`} className="object-contain" style={{ height: logoSize, maxWidth: logoMaxW }} />
                    ) : (
                      <div key="badge" className="h-[50px] rounded-sm border border-sky-400/60 bg-gradient-to-br from-[#0b1f4d] via-[#123a7a] to-[#0b1f4d] flex flex-col justify-center px-2 min-w-0" style={{ maxWidth: Math.max(logoMaxW, 120) }}>
                        <span className="font-semibold tracking-wide leading-none whitespace-nowrap" style={{ fontFamily: 'Georgia, serif', ...s('badge1') }}>{t('badge1')}</span>
                        <span className="font-semibold leading-none mt-0.5 whitespace-nowrap" style={{ fontFamily: 'Georgia, serif', ...s('badge2') }}>{t('badge2')}</span>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* NAMA INSTANSI */}
              <div className="text-center mt-[12px] font-black leading-tight tracking-wide">
                {t('org1') && <div style={s('org1')}>{t('org1')}</div>}
                {t('org2') && <div style={s('org2')}>{t('org2')}</div>}
              </div>

              {/* JUDUL + KARTU AIR ROB */}
              <div className="flex justify-between mt-[10px]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <div className="w-[48px] h-[48px] rounded-full bg-orange-500 flex items-center justify-center shadow z-10 border-[3px] border-white">
                      <CalendarDays className="w-6 h-6 text-white" />
                    </div>
                    <div className="-ml-3 pl-6 pr-6 h-[34px] bg-[#0b1f4d] rounded-r-full flex items-center">
                      <span className="font-black tracking-wide whitespace-nowrap" style={s('pill')}>{t('pill')}</span>
                    </div>
                  </div>
                  <div className="font-black leading-[0.95] tracking-tight mt-[6px] whitespace-nowrap" style={s('title1')}>{t('title1')}</div>
                  <div className="font-black leading-[0.95] tracking-tight whitespace-nowrap" style={s('title2')}>{t('title2')}</div>
                  <div className="inline-block mt-[6px] bg-gradient-to-r from-amber-300 to-yellow-400 rounded-full px-6 py-1 shadow">
                    <span className="font-black tracking-wide whitespace-nowrap" style={s('period')}>{periodLabel}</span>
                  </div>
                </div>
                <div className="w-[176px] h-[190px] bg-white/95 rounded-2xl shadow-lg p-3 flex flex-col flex-shrink-0 mt-[10px]">
                  <div className="flex items-center gap-1.5">
                    <Waves className="w-6 h-6 text-blue-600" />
                    <span className="font-black leading-none" style={s('cardTitle')}>{t('cardTitle')}</span>
                  </div>
                  <p className="font-medium leading-snug mt-2 flex-1 overflow-hidden" style={s('cardDesc')}>{t('cardDesc')}</p>
                  <div className="self-end"><Waves className="w-9 h-9 text-blue-500" strokeWidth={1.5} /></div>
                </div>
              </div>

              {/* TABEL */}
              <div className="mt-[12px] bg-white/95 rounded-2xl shadow-xl p-2.5 flex flex-col">
                <div className="bg-[#0b1f4d] rounded-xl h-[34px] grid grid-cols-[150px_1fr_220px] items-center font-black tracking-wide">
                  <div className="text-center" style={s('th1')}>{t('th1')}</div>
                  <div className="flex items-center justify-center gap-1.5 border-x border-white/20" style={s('th2')}><Clock className="w-4 h-4" /> {t('th2')}</div>
                  <div className="text-center" style={s('th3')}>{t('th3')}</div>
                </div>
                <div className="flex flex-col gap-[4px] mt-[5px]" style={{ height: 306 }}>
                  {sortedRows.map((r) => {
                    const d = parseDate(r.date);
                    return (
                      <div key={r.id} className="grid grid-cols-[150px_1fr_220px] items-center bg-white rounded-xl border border-slate-200 border-l-[5px] border-l-orange-500 shadow-sm overflow-hidden" style={{ height: rowH }}>
                        <div className="flex items-center gap-2 pl-3">
                          <div className="w-[32px] h-[32px] rounded-md border-2 border-orange-500 flex items-center justify-center flex-shrink-0">
                            <CalendarDays className="w-5 h-5 text-orange-500" />
                          </div>
                          {big ? (
                            <div className="flex-1 text-center leading-none font-black">
                              <div style={s('rDay')}>{d ? HARI[d.getDay()] : '-'}</div>
                              <div className="leading-[1]" style={s('rDate')}>{d ? d.getDate() : '-'}</div>
                              <div style={s('rMonth')}>{d ? BULAN[d.getMonth()] : ''}</div>
                            </div>
                          ) : (
                            <div className="flex-1 text-center leading-none font-black">
                              <div style={s('rDay', { factor: 10 / 12 })}>{d ? HARI[d.getDay()] : '-'}</div>
                              <div className="whitespace-nowrap mt-[2px]">
                                <span style={s('rDate', { factor: 20 / 34 })}>{d ? d.getDate() : '-'}</span>{' '}
                                <span style={s('rMonth', { factor: 10 / 12 })}>{d ? BULAN[d.getMonth()].slice(0, 3) : ''}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-center justify-center border-x border-slate-200 h-[70%]">
                          <div className="font-black leading-none whitespace-nowrap" style={s('rTime', { factor: big ? 1 : 19 / 24 })}>
                            {fmtTime(r.start)} – {fmtTime(r.end)}{' '}
                            <span style={s('rZone', { factor: big ? 1 : 12 / 15 })}>{t('rZone')}</span>
                          </div>
                          {big && <div className="mt-1.5"><WaveLine width={150} /></div>}
                        </div>
                        <div className="flex items-center justify-between pl-3 pr-2">
                          <div className="leading-none font-black">
                            <div className="flex items-baseline" style={s('rHeight', { factor: big ? 1 : 30 / 44 })}>
                              <span style={{ fontSize: '0.5em' }}>±</span>
                              <span>{fmtHeight(r.height)}</span>
                            </div>
                            <div className="flex items-end gap-2">
                              <span style={s('rUnit', { factor: big ? 1 : 12 / 15 })}>{t('rUnit')}</span>
                              <span className="pb-[1px] whitespace-nowrap" style={s('rRef')}>{t('rRef')}</span>
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
                    <span className="font-black tracking-wide" style={s('noteTitle')}>{t('noteTitle')}</span>
                  </div>
                  <div className="grid grid-cols-3 mt-1.5">
                    {[House, Wind, TriangleAlert].map((Icon, i) => (
                      <div key={i} className={`flex items-start gap-2 px-2 ${i > 0 ? 'border-l border-slate-300' : ''}`}>
                        <Icon className={`w-8 h-8 flex-shrink-0 ${i === 2 ? 'text-amber-500' : 'text-[#0b1f4d]'}`} strokeWidth={1.8} />
                        <p className="leading-snug font-medium" style={s(`note${i + 1}`)}>{t(`note${i + 1}`)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="mt-auto">
                <div className="bg-[#0b1f4d] rounded-2xl h-[82px] grid grid-cols-[1.25fr_1fr_1.2fr] items-center px-3 text-white shadow-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    {footerLogo && <img src={footerLogo} className="w-[52px] h-[52px] object-contain flex-shrink-0" alt="Logo footer" />}
                    <div className="leading-tight min-w-0">
                      <div className="font-black" style={s('fTitle1')}>{t('fTitle1')}</div>
                      <div className="font-black" style={s('fTitle2')}>{t('fTitle2')}</div>
                      <div className="opacity-90" style={s('fCcLabel')}>{t('fCcLabel')}</div>
                      <div className="font-black" style={s('fCc')}>{t('fCc')}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center border-x border-white/20">
                    <div className="bg-white rounded-2xl px-3 py-1 flex items-center gap-1.5">
                      <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center"><Phone className="w-4 h-4 text-white" /></div>
                      <div className="leading-none text-center">
                        <div className="font-black leading-none" style={s('f112')}>{t('f112')}</div>
                        <div className="font-black" style={s('f112Sub')}>{t('f112Sub')}</div>
                      </div>
                    </div>
                    <div className="mt-1 opacity-90" style={s('f112Note')}>{t('f112Note')}</div>
                  </div>
                  <div className="flex items-start gap-2 pl-3 min-w-0">
                    <Globe className="w-7 h-7 flex-shrink-0" strokeWidth={1.6} />
                    <div className="leading-tight min-w-0">
                      <div className="font-black" style={s('fInfoTitle')}>{t('fInfoTitle')}</div>
                      <div className="opacity-90 truncate" style={s('fInfo1')}>{t('fInfo1')}</div>
                      <div className="opacity-90 truncate" style={s('fInfo2')}>{t('fInfo2')}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 font-semibold mt-[5px] whitespace-nowrap" style={s('strip')}>
                  {([
                    [Facebook, 'sFb'], [Instagram, 'sIg'], [Phone, 'sPhone'], [Mail, 'sMail'], [Globe, 'sWeb'],
                  ] as const).filter(([, k]) => t(k)).map(([Icon, k], i) => (
                    <span key={k} className="flex items-center gap-2">
                      {i > 0 && <span>|</span>}
                      <span className="flex items-center gap-0.5"><Icon style={{ width: '1.3em', height: '1.3em' }} />{t(k)}</span>
                    </span>
                  ))}
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
