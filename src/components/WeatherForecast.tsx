import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Upload, RefreshCw, Clock } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  DEFAULT_OVERLAY, makeLogos, useTextFields,
  type LogoItem, type OverlaySettings, type TextDef,
} from '../lib/customize';
import { LogoManager, OverlayEditor, OverlayLayer, Section, TextFieldsEditor } from './shared/Customize';
import pemkoLogo from '../assets/pemko.png';
import yaLogo from '../assets/maju-sejahtera.png';
import bpbdLogo from '../assets/bpbd.png';
import logo112 from '../assets/112.png';

interface ForecastItem {
  datetime: string;
  local_datetime?: string;
  weather: string | number;
  weather_desc: string;
  t: number;
  hu: number;
  ws: number;
  wd_to: string;
  vs?: number | null;
  vs_text?: string | null;
  [key: string]: unknown;
}

interface WeatherData {
  data: Array<{
    cuaca: ForecastItem[][];
  }>;
}

const BMKG_URL = 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=63.71.05.1001';
const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WITA_MS = 8 * HOUR_MS;
const PREVIEW_W = 672;
const PREVIEW_MIN_H = 838; // 1080 x 1348 setelah diskalakan
const OUTPUT_W = 1080;
const DEFAULT_LOGOS = [pemkoLogo, yaLogo, bpbdLogo, logo112];

const WF_TEXT_DEFS: TextDef[] = [
  { key: 'org1', group: 'Header', label: 'Nama instansi baris 1', text: 'BADAN PENANGGULANGAN BENCANA DAERAH', color: '#1f2937', size: 13 },
  { key: 'org2', group: 'Header', label: 'Nama instansi baris 2', text: 'KOTA BANJARMASIN', color: '#1f2937', size: 13 },
  { key: 'title', group: 'Header', label: 'Judul', text: 'PRAKIRAAN CUACA', color: '#111827', size: 42 },
  { key: 'subtitle', group: 'Header', label: 'Subjudul (diikuti tanggal otomatis)', text: 'KOTA BANJARMASIN', color: '#1f2937', size: 16 },

  { key: 'cTime', group: 'Kartu cuaca', label: 'Jam (+ zona waktu)', text: 'WITA', color: '#1f2937', size: 12 },
  { key: 'cIcon', group: 'Kartu cuaca', label: 'Ikon cuaca', size: 38 },
  { key: 'cTemp', group: 'Kartu cuaca', label: 'Suhu', color: '#111827', size: 28 },
  { key: 'cDesc', group: 'Kartu cuaca', label: 'Deskripsi cuaca', color: '#374151', size: 12 },
  { key: 'cDetail', group: 'Kartu cuaca', label: 'Detail (kelembapan, angin, jarak pandang)', color: '#4b5563', size: 11 },

  { key: 'source', group: 'Peringatan', label: 'Sumber data', text: 'Sumber Data : BMKG Indonesia', color: '#ffffff', size: 12 },
  { key: 'warnTitle', group: 'Peringatan', label: 'Judul peringatan', text: 'PERINGATAN :', color: '#ffffff', size: 18 },
  { key: 'warnText', group: 'Peringatan', label: 'Teks peringatan', text: 'DIPERKIRAKAN CUACA BANJARMASIN DAN SEKITARNYA AKAN CERAH BERAWAN', multiline: true, color: '#ffffff', size: 14 },
  { key: 'appeal', group: 'Peringatan', label: 'Kotak himbauan (kuning)', multiline: true, color: '#111827', size: 13,
    text: 'HIMBAUAN AGAR TETAP WASPADA KETIKA BERAKTIVITAS DI LUAR RUANGAN\nDAN SELALU PANTAU PERKEMBANGAN CUACA TERKINI !' },

  { key: 'footer', group: 'Footer & Kontak', label: 'Teks footer (warna & ukuran semua item)', color: '#ffffff', size: 10.5 },
  { key: 'fIg', group: 'Footer & Kontak', label: 'Instagram', text: 'bpbd_kota_banjarmasin' },
  { key: 'fPhone', group: 'Footer & Kontak', label: 'Telepon', text: '085186891117' },
  { key: 'fMail', group: 'Footer & Kontak', label: 'Email', text: 'bpbdk.bjm3@gmail.com' },
  { key: 'fWeb', group: 'Footer & Kontak', label: 'Website', text: 'bpbd.banjarmasinkota.go.id' },
];

const WeatherForecast = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState(50);
  const [showGrid, setShowGrid] = useState(true);
  const [logos, setLogos] = useState<LogoItem[]>(() => makeLogos(DEFAULT_LOGOS));
  const [logoSize, setLogoSize] = useState(50);
  const [overlay, setOverlay] = useState<OverlaySettings>(DEFAULT_OVERLAY);
  const [startHour, setStartHour] = useState(12);
  const [hourInterval, setHourInterval] = useState(3);
  const tf = useTextFields(WF_TEXT_DEFS);
  const { t, s } = tf;
  const [isDownloading, setIsDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchWeatherData = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    setFetchError(null);
    try {
      // cache: 'no-store' → tombol Refresh benar-benar mengambil data baru
      // (respons BMKG membawa Cache-Control max-age=3600, browser bisa menyajikan data lama hingga 1 jam)
      const response = await fetch(BMKG_URL, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? 'Batas permintaan BMKG terlampaui (maks. 60 permintaan/menit per IP). Tunggu sebentar lalu klik Refresh.'
            : `Server BMKG merespons HTTP ${response.status}. Coba lagi beberapa saat.`
        );
      }
      const data = (await response.json()) as WeatherData;
      if (!data?.data?.[0]?.cuaca?.flat().length) {
        throw new Error('Data BMKG kosong atau formatnya berubah (data[0].cuaca tidak ditemukan).');
      }
      setWeatherData(data);
      setLastFetched(new Date());
    } catch (error) {
      console.error('Error fetching weather data:', error);
      const msg =
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Permintaan ke BMKG melebihi 15 detik (timeout). Periksa koneksi lalu klik Refresh.'
          : error instanceof TypeError
            ? 'Tidak dapat menghubungi api.bmkg.go.id (koneksi terputus, diblokir jaringan/ekstensi browser, atau server BMKG sedang gangguan).'
            : error instanceof Error ? error.message : String(error);
      setFetchError(msg);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeatherData();
  }, [fetchWeatherData]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setBackgroundImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getWeatherIcon = (weatherCode: string | number) => {
    const code = parseInt(String(weatherCode));
    if (code === 0 || code === 1) return '☀️';
    if (code === 2) return '⛅';
    if (code === 3 || code === 4) return '☁️';
    if (code === 17 || code === 95 || code === 97) return '⛈️';
    if (code >= 60 && code <= 63) return '🌧️';
    if (code >= 10 && code <= 45) return '🌥️';
    return '☁️';
  };

  const formatTime = (datetime: string | number | Date) => {
    const date = new Date(datetime);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Makassar'
    });
  };

  const formatDateIndonesian = (dateStr: string | number | Date) => {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    // Selalu pakai WITA (UTC+8), tidak tergantung zona waktu perangkat pengguna
    const date = new Date(new Date(dateStr).getTime() + WITA_MS);
    return `${days[date.getUTCDay()].toUpperCase()}, ${date.getUTCDate()} ${months[date.getUTCMonth()].toUpperCase()} ${date.getUTCFullYear()}`;
  };

  const visibilityText = (f: ForecastItem) =>
    f.vs_text || (typeof f.vs === 'number' ? (f.vs >= 1000 ? `${+(f.vs / 1000).toFixed(1)} km` : `${f.vs} m`) : '');

  const translateWindDirection = (direction: string) => {
    const directions: Record<string, string> = {
      N: 'Utara↑',
      NNE: 'Utara Timur Laut',
      NE: 'Timur Laut ',
      ENE: 'Timur Timur Laut',
      E: 'Timur→',
      ESE: 'Timur Tenggara',
      SE: 'Tenggara↘',
      SSE: 'Selatan Tenggara',
      S: 'Selatan⇣',
      SSW: 'Selatan Barat Daya',
      SW: 'Barat Daya↙',
      WSW: 'Barat Barat Daya',
      W: 'Barat←',
      WNW: 'Barat Barat Laut',
      NW: 'Barat Laut↖',
      NNW: 'Utara Barat Laut',
      VARIABLE: 'Berubah-ubah'
    };
    return directions[direction] || direction;
  };

  const getTodayForecasts = (): { items: ForecastItem[]; note: string | null } => {
    const all = (weatherData?.data?.[0]?.cuaca ?? []).flat().filter((f) => f && f.datetime);
    if (all.length === 0) return { items: [], note: null };

    const times = all.map((f) => new Date(f.datetime).getTime());
    const firstMs = Math.min(...times);
    const lastMs = Math.max(...times);
    const nowMs = Date.now();
    // Tengah malam WITA hari ini, dalam UTC
    const todayStart = Math.floor((nowMs + WITA_MS) / DAY_MS) * DAY_MS - WITA_MS;

    const build = (dayStart: number, skipPast: boolean) => {
      const result: ForecastItem[] = [];
      for (let h = startHour; h < 24 && result.length < 6; h += hourInterval) {
        const target = dayStart + h * HOUR_MS;
        // Jam yang sudah lewat (sama seperti sebelumnya: jam < jam sekarang)
        if (skipPast && target + HOUR_MS <= nowMs) continue;
        // Jangan "mengarang" data di luar rentang yang tersedia dari BMKG (data per 3 jam)
        if (target < firstMs - 1.5 * HOUR_MS || target > lastMs + 1.5 * HOUR_MS) continue;

        let closest = all[0];
        let minDiff = Infinity;
        all.forEach((f, i) => {
          const diff = Math.abs(times[i] - target);
          if (diff < minDiff) { minDiff = diff; closest = f; }
        });
        const iso = new Date(target).toISOString();
        result.push({ ...closest, datetime: iso, local_datetime: iso });
      }
      return result;
    };

    const today = build(todayStart, true);
    if (today.length) return { items: today, note: null };

    // Semua jam pilihan hari ini sudah lewat (mis. dibuka malam hari) → tampilkan besok
    const tomorrow = build(todayStart + DAY_MS, false);
    if (tomorrow.length) {
      return { items: tomorrow, note: 'Jam yang dipilih untuk hari ini sudah lewat, jadi yang ditampilkan adalah prakiraan BESOK. Ubah "Jam Mulai" bila perlu.' };
    }
    return { items: [], note: 'Tidak ada data BMKG untuk jam yang dipilih. Ubah "Jam Mulai" atau interval.' };
  };

  const downloadImage = async () => {
    if (!previewRef.current) return;
    setIsDownloading(true);
    try {
      const node = previewRef.current;
      const height = node.offsetHeight;
      const dataUrl = await toPng(node, {
        pixelRatio: OUTPUT_W / PREVIEW_W,
        cacheBust: true,
        width: PREVIEW_W,
        height,
        style: { borderRadius: '0', border: 'none', boxShadow: 'none', margin: '0', transform: 'none' },
      });
      const link = document.createElement('a');
      link.download = `prakiraan-cuaca-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
      alert('Gagal mengunduh gambar. Silakan coba lagi.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Halaman selalu dirender (navigasi tetap bisa dipakai) walau data BMKG gagal dimuat
  const { items: forecasts, note: forecastNote } = getTodayForecasts();
  const firstForecastDate = forecasts[0]?.local_datetime || new Date().toISOString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Controls */}
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left w-full md:w-auto">
              <h1 className="text-xl md:text-3xl font-bold text-gray-800">Generator Prakiraan Cuaca BPBD</h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base">Data real-time dari BMKG API</p>
            </div>
            <div className="flex flex-wrap w-full md:w-auto justify-center gap-2 sm:gap-3">
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/udara');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="flex-1 sm:flex-none flex justify-center items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                Kualitas Udara (ISPU) →
              </button>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/rob');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="flex-1 sm:flex-none flex justify-center items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                Pasang / Air Rob →
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 sm:flex-none flex justify-center items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                Upload
              </button>
              <button
                onClick={fetchWeatherData}
                disabled={loading}
                className="flex-1 sm:flex-none flex justify-center items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Memuat...' : 'Refresh'}
              </button>
              <button
                onClick={downloadImage}
                disabled={isDownloading}
                className="w-full sm:w-auto sm:flex-none flex justify-center items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-wait text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                {isDownloading ? <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Download className="w-4 h-4 sm:w-5 sm:h-5" />}
                {isDownloading ? 'Mengunduh...' : 'Download'}
              </button>
            </div>
          </div>

          {/* Status data BMKG */}
          <div className="mt-3 text-xs text-gray-500">
            {loading && <span className="inline-flex items-center gap-1 text-blue-600 mr-2"><RefreshCw className="w-3 h-3 animate-spin" /> Memuat data BMKG...</span>}
            {!loading && !weatherData && !fetchError && <>Belum ada data BMKG.</>}
            {lastFetched && <>Data BMKG diambil pukul {lastFetched.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })} WITA</>}
            {weatherData?.data?.[0]?.cuaca?.[0]?.[0]?.analysis_date ? <> · analisis BMKG {String(weatherData.data[0].cuaca[0][0].analysis_date).replace('T', ' ')} UTC</> : null}
          </div>
          {fetchError && (
            <div className="mt-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              ⚠️ {fetchError}{' '}
              {weatherData
                ? <span>Pratinjau masih memakai data terakhir yang berhasil diambil.</span>
                : <span>Halaman tetap bisa dipakai tanpa data cuaca; klik <b>Refresh</b> untuk mencoba lagi.</span>}
            </div>
          )}
          {forecastNote && (
            <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">ℹ️ {forecastNote}</div>
          )}

          {/* Grid Settings */}
          {backgroundImage && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-6 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Tampilkan Grid</span>
                </label>

                {showGrid && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Ukuran Grid:</label>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="10"
                      value={gridSize}
                      onChange={(e) => setGridSize(Number(e.target.value))}
                      className="w-32"
                    />
                    <span className="text-sm text-gray-600 w-12">{gridSize}px</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <Section title="🌗 Overlay (jenis, arah & warna)">
            <OverlayEditor value={overlay} onChange={setOverlay} />
          </Section>

          {/* Settings Waktu Prakiraan */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-gray-700" />
              <h3 className="text-sm font-bold text-gray-800">Pengaturan Jam & Interval Prediksi</h3>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start justify-center">
              {/* Clock UI */}
              <div className="flex flex-col items-center">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Jam Mulai (Pilih pada jam)</h4>
                <div className="relative w-48 h-48 bg-white rounded-full border-4 border-gray-200 shadow-inner flex items-center justify-center">
                  <div className="w-3 h-3 bg-gray-600 rounded-full absolute z-10 shadow-sm"></div>
                  {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map((hour) => {
                    return (
                      <button
                        key={hour}
                        onClick={() => setStartHour(hour)}
                        className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200
                          ${startHour === hour
                            ? 'bg-blue-600 text-white scale-125 shadow-lg z-20'
                            : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                          }
                        `}
                        style={{
                          transform: `rotate(${hour * 15}deg) translate(0, -75px) rotate(-${hour * 15}deg)`
                        }}
                      >
                        {hour.toString().padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center mt-4 gap-2">
                  <span className="text-xs text-gray-500 font-medium">Jam Spesifik:</span>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={startHour}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 0 && val <= 23) {
                        setStartHour(val);
                      }
                    }}
                    className="w-16 p-1 text-center border border-gray-300 rounded font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <span className="text-xs text-gray-500 font-medium">WITA</span>
                </div>
              </div>

              {/* Interval UI */}
              <div className="flex flex-col w-full md:w-64">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Interval Jam (Jarak antar data)</h4>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="range"
                      min="1"
                      max="6"
                      step="1"
                      value={hourInterval}
                      onChange={(e) => setHourInterval(Number(e.target.value))}
                      className="w-full flex-grow accent-blue-600"
                    />
                    <span className="text-sm font-bold px-3 py-1 bg-blue-100 text-blue-800 rounded-md whitespace-nowrap">
                      {hourInterval} Jam
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Catatan: Data BMKG ada setiap kelipatan 3 Jam, aplikasi akan mencarikan jam terdekat ke depan. Mengatur jarak antar card prediksi yang ditampilkan (<b>tidak melewati hari ini / maks 23:59</b>).
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Section title="📸 Logo Header">
            <LogoManager logos={logos} onChange={setLogos} defaults={DEFAULT_LOGOS} size={logoSize} onSizeChange={setLogoSize} sizeMin={32} sizeMax={96} />
          </Section>

          <Section title="✏️ Teks, Kontak & Footer (isi, warna, ukuran font)">
            <TextFieldsEditor fields={tf} />
          </Section>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* Preview: 672px → unduhan 1080px (min 1080x1348) */}
        <div className="w-full overflow-x-auto pb-6">
          <div
            ref={previewRef}
            className="relative rounded-xl shadow-2xl overflow-hidden mx-auto z-0 flex flex-col"
            style={{
              minWidth: `${PREVIEW_W}px`,
              maxWidth: `${PREVIEW_W}px`,
              minHeight: `${PREVIEW_MIN_H}px`,
              backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'linear-gradient(to bottom, #87CEEB, #98D8E8)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Blur overlay */}
            <div className="absolute inset-0 backdrop-blur-sm bg-white/10 z-0"></div>

            {/* Overlay warna */}
            <OverlayLayer value={overlay} className="z-10" />

            {/* Grid overlay */}
            {backgroundImage && showGrid && (
              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent ${gridSize - 1}px, rgba(150, 150, 150, 0.3) ${gridSize - 1}px, rgba(150, 150, 150, 0.3) ${gridSize}px),
          repeating-linear-gradient(90deg, transparent, transparent ${gridSize - 1}px, rgba(150, 150, 150, 0.3) ${gridSize - 1}px, rgba(150, 150, 150, 0.3) ${gridSize}px)
          `,
                  backgroundSize: `${gridSize}px ${gridSize}px`
                }}
              />
            )}

            <div className="relative px-7 pt-5 pb-3 z-20 flex flex-col flex-1">
              {/* Header Section */}
              <div className="text-center mb-3">
                {logos.length > 0 && (
                  <div className="flex justify-center items-center gap-4 mb-3">
                    {logos.map((logo, index) => (
                      <img
                        key={logo.id}
                        src={logo.src}
                        alt={`Logo ${index + 1}`}
                        className="object-contain"
                        style={{ height: logoSize, maxWidth: Math.floor((PREVIEW_W - 56 - (logos.length - 1) * 16) / logos.length) }}
                      />
                    ))}
                  </div>
                )}

                {t('org1') && <h2 className="font-bold leading-tight mb-0.5" style={s('org1')}>{t('org1')}</h2>}
                {t('org2') && <h2 className="font-bold leading-tight mb-2" style={s('org2')}>{t('org2')}</h2>}

                <h1 className="font-black mb-1 leading-tight" style={s('title')}>{t('title')}</h1>
                <p className="font-semibold" style={s('subtitle')}>{t('subtitle') ? `${t('subtitle')}, ` : ''}{formatDateIndonesian(firstForecastDate)}</p>
              </div>

              {/* Weather Cards Grid */}
              {forecasts.length === 0 && (
                <div className="mx-auto mb-3 w-[90%] rounded-2xl bg-white/70 border-2 border-dashed border-white px-4 py-10 text-center text-gray-600 text-sm font-semibold">
                  {loading ? 'Memuat data prakiraan cuaca BMKG...' : 'Data prakiraan cuaca belum tersedia.'}
                </div>
              )}
              <div className="flex flex-col gap-2.5 mb-3 items-center w-full">
                {(forecasts.length === 4
                  ? [forecasts.slice(0, 2), forecasts.slice(2, 4)]
                  : forecasts.length === 5
                    ? [forecasts.slice(0, 3), forecasts.slice(3, 5)]
                    : forecasts.length === 6
                      ? [forecasts.slice(0, 3), forecasts.slice(3, 6)]
                      : [forecasts]
                ).map((row, rowIndex) => (
                  <div key={rowIndex} className="flex justify-center gap-2.5 w-full">
                    {row.map((forecast, index) => (
                      <div
                        key={`${rowIndex}-${index}`}
                        className="bg-white/85 backdrop-blur-sm rounded-2xl px-3 py-2.5 shadow-lg flex-shrink-0"
                        style={{ width: 'calc(33.333% - 8px)', minWidth: '150px' }}
                      >
                        <div className="text-center">
                          <p className="font-bold mb-1" style={s('cTime')}>{formatTime(forecast.datetime)} {t('cTime')}</p>
                          <div className="mb-1 leading-none" style={s('cIcon')}>{getWeatherIcon(forecast.weather)}</div>
                          <p className="font-bold" style={s('cTemp')}>{forecast.t}°C</p>
                          <p className="mb-1.5" style={s('cDesc')}>{forecast.weather_desc}</p>

                          <div className="space-y-0.5" style={s('cDetail')}>
                            <div className="flex items-center justify-between px-2">
                              <span>💧 {forecast.hu}%</span>
                              <span>💨 {Math.round(forecast.ws)} km/jam</span>
                            </div>
                            <div className="flex items-center justify-between px-2">
                              <span>🧭 {translateWindDirection(forecast.wd_to)}</span>
                              {visibilityText(forecast) && <span>👁️ {visibilityText(forecast)}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Warning Section */}
              <div className="text-center mb-3 px-2 mt-auto">
                {t('source') && <p className="italic text-right drop-shadow-lg mb-1" style={s('source')}>{t('source')}</p>}
                {t('warnTitle') && <h3 className="font-bold mb-1 drop-shadow-lg" style={s('warnTitle')}>{t('warnTitle')}</h3>}
                {t('warnText') && (
                  <p className="mb-2 drop-shadow-lg whitespace-pre-wrap break-words px-2 mx-auto max-w-full" style={s('warnText')}>
                    {t('warnText')}
                  </p>
                )}
                {t('appeal') && (
                  <div className="bg-yellow-400 rounded-lg px-4 py-2.5 shadow-lg w-full max-w-[95%] mx-auto">
                    <p className="font-bold leading-relaxed whitespace-pre-line" style={s('appeal')}>{t('appeal')}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-700 rounded-lg px-2 py-1.5">
                <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1" style={s('footer')}>
                  {t('fIg') && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 border-2 rounded-md flex items-center justify-center" style={{ borderColor: 'currentColor' }}>
                        <div className="w-2.5 h-2.5 border-2 rounded-full" style={{ borderColor: 'currentColor' }}></div>
                      </div>
                      <span>{t('fIg')}</span>
                    </div>
                  )}
                  {t('fPhone') && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className="w-3 h-5 border-2 rounded" style={{ borderColor: 'currentColor' }}></div>
                      </div>
                      <span>{t('fPhone')}</span>
                    </div>
                  )}
                  {t('fMail') && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <svg width="18" height="13" viewBox="0 0 18 13" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="1" y="1" width="16" height="11" />
                          <path d="M1 1 L9 7 L17 1" />
                        </svg>
                      </div>
                      <span>{t('fMail')}</span>
                    </div>
                  )}
                  {t('fWeb') && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="9" cy="9" r="7" />
                          <ellipse cx="9" cy="9" rx="2.5" ry="7" />
                          <line x1="2" y1="9" x2="16" y2="9" />
                        </svg>
                      </div>
                      <span>{t('fWeb')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-white rounded-lg p-6 shadow-lg max-w-2xl mx-auto">
          <h3 className="font-bold text-gray-800 mb-3">📋 Cara Penggunaan</h3>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>✅ <strong>Upload Background:</strong> Klik "Upload" untuk background custom</li>
            <li>✅ <strong>Logo:</strong> Tambah, hapus, ganti (klik logo), dan seret ⠿ untuk mengubah urutan</li>
            <li>✅ <strong>Teks:</strong> Semua teks, kontak, dan footer bisa diubah isi, warna, dan ukuran fontnya</li>
            <li>✅ <strong>Overlay:</strong> Pilih solid / gradien linear / radial, arah, warna, dan opacity</li>
            <li>✅ <strong>Refresh Data:</strong> Klik "Refresh" untuk update cuaca terbaru dari BMKG</li>
            <li>✅ <strong>Download:</strong> Hasil sama dengan pratinjau, lebar 1080px (tinggi min. 1348px)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
export default WeatherForecast;