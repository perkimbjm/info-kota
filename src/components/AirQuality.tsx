import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Upload, RefreshCw } from 'lucide-react';
import { toPng } from 'html-to-image';
import pemkoLogo from '../assets/pemko.png';
import yaLogo from '../assets/maju-sejahtera.png';
import bpbdLogo from '../assets/bpbd.png';
import logo112 from '../assets/112.png';

interface Kategori {
  nilai: string;
  keterangan: string;
  color: string;
  color_text: string;
  nilai_uid?: string;
  icon?: string;
}

interface IspuRow {
  id_stasiun: string;
  waktu: string;
  pm10: string;
  pm25: string;
  so2: string;
  co: string;
  o3: string;
  no2: string;
  hc: string;
  tipe_text: string;
  kategori: Kategori;
  [key: string]: unknown;
}

interface IspuData {
  rows: IspuRow[];
}

// Export module scope elements to avoid TS6133 unused locals error
export const tipsList = [
  { em: '😷', text: 'Gunakan masker saat kualitas udara menurun atau ketika berada di area berasap.' },
  { em: '🚫', text: 'Hindari membakar sampah atau lahan.' },
  { em: '🏥', text: 'Segera periksakan diri ke fasilitas kesehatan apabila mengalami gangguan pernapasan.' }
];

export const getContrastColor = (hexcolor: string) => {
  if (!hexcolor) return '#1E293B';
  const cleanHex = hexcolor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#1E293B' : '#FFFFFF';
};

export const getIspuColor = (val: number) => {
  if (val <= 50) return '#00cc00'; // Green - Baik
  if (val <= 100) return '#0000ff'; // Blue - Sedang
  if (val <= 200) return '#ffff00'; // Yellow - Tidak Sehat
  if (val <= 300) return '#ff0000'; // Red - Sangat Tidak Sehat
  return '#000000'; // Black - Berbahaya
};

export const getIspuLabel = (val: number) => {
  if (val <= 50) return 'BAIK';
  if (val <= 100) return 'SEDANG';
  if (val <= 200) return 'TIDAK SEHAT';
  if (val <= 300) return 'SANGAT TIDAK SEHAT';
  return 'BERBAHAYA';
};

export const getCategoryDetails = (nilai: string) => {
  const norm = (nilai || '').toUpperCase().trim();
  if (norm === 'BAIK') {
    return {
      warna: '#00cc00',
      artinya: 'Kualitas udara sangat baik, tidak memberikan efek negatif terhadap manusia, hewan, dan tumbuhan.',
      kelompokSensitif: 'Sangat aman untuk melakukan aktivitas di luar ruangan secara normal tanpa memerlukan perlindungan khusus.',
      note: 'Kualitas udara sangat baik and tidak memberikan dampak buruk bagi kesehatan tubuh Anda.',
      arrowIndex: 4
    };
  } else if (norm === 'TIDAK SEHAT') {
    return {
      warna: '#ffff00',
      artinya: 'Kualitas udara bersifat merugikan pada manusia, hewan, dan tumbuhan yang sensitif.',
      kelompokSensitif: 'Kelompok sensitif (anak-anak, lansia, ibu hamil) sebaiknya membatasi aktivitas fisik di luar ruangan secara berlebihan.',
      note: 'Kualitas udara saat ini TIDAK SEHAT, kurangi durasi aktivitas berat di luar ruangan.',
      arrowIndex: 2
    };
  } else if (norm === 'SANGAT TIDAK SEHAT') {
    return {
      warna: '#ff0000',
      artinya: 'Kualitas udara dapat meningkatkan risiko kesehatan pada segmen populasi yang sensitif secara signifikan.',
      kelompokSensitif: 'Hindari aktivitas luar ruangan yang lama atau berat bagi kelompok sensitif. Masyarakat umum kurangi aktivitas luar ruangan.',
      note: 'Kualitas udara SANGAT TIDAK SEHAT, disarankan untuk menggunakan masker medis jika terpaksa keluar.',
      arrowIndex: 1
    };
  } else if (norm === 'BERBAHAYA') {
    return {
      warna: '#000000',
      artinya: 'Kualitas udara tingkat serius yang dapat merugikan kesehatan populasi secara luas dan membutuhkan penanganan darurat.',
      kelompokSensitif: 'Seluruh kelompok masyarakat disarankan untuk tinggal di dalam ruangan dan meminimalkan aktivitas fisik luar ruangan.',
      note: 'Status Kualitas Udara BERBAHAYA! Tetap berada di dalam rumah dan nyalakan pembersih udara.',
      arrowIndex: 0
    };
  } else {
    // Default / SEDANG (Moderate)
    return {
      warna: '#0000ff',
      artinya: 'Kualitas udara masih dapat diterima dan umumnya aman bagi sebagian besar masyarakat untuk beraktivitas seperti biasa.',
      kelompokSensitif: 'Kelompok sensitif (anak-anak, lansia, ibu hamil dan penderita asma) disarankan mengurangi aktivitas berat di luar ruangan jika mulai merasakan gejala seperti batuk, sesak napas, atau iritasi mata dan tenggorokan.',
      note: 'Meskipun saat ini kualitas udara masih dalam kategori SEDANG, masyarakat tetap perlu waspada dan terus memantau perkembangannya.',
      arrowIndex: 3
    };
  }
};

const AirQuality = () => {
  const [ispuData, setIspuData] = useState<IspuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState(50);
  const [showGrid, setShowGrid] = useState(false);
  const [logos, setLogos] = useState<(string | null)[]>([pemkoLogo, yaLogo, bpbdLogo, logo112]);
  const [gradientEnabled, setGradientEnabled] = useState(false);
  const [gradientColor, setGradientColor] = useState('#000000');
  const [gradientOpacity, setGradientOpacity] = useState(50);

  // Default background color picker (when no image uploaded)
  const [bgMode, setBgMode] = useState<'gradient' | 'solid'>('gradient');
  const [bgColor1, setBgColor1] = useState('#BFEFFF');
  const [bgColor2, setBgColor2] = useState('#4FA8D4');

  // Text color pickers
  const [titleColor, setTitleColor] = useState('#0F2C59');       // INFO + KUALITAS UDARA
  const [taglineColor, setTaglineColor] = useState('#065F46');   // Udara Bersih + Sumber

  // Custom Warning text
  const [warningText, setWarningText] = useState(
    'Memasuki musim kemarau, kebakaran hutan dan lahan di beberapa kabupaten/kota sekitar dapat menghasilkan asap yang terbawa angin hingga memengaruhi kualitas udara di wilayah Banjarmasin.'
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchIspuData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('https://ispu.kemenlh.go.id/apimobile/v1/getDetail/stasiun/BANJARMASIN');
      const data = await response.json();
      setIspuData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching ISPU data:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIspuData();
  }, [fetchIspuData]);

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

  const handleLogoUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newLogos = [...logos];
          newLogos[index] = event.target.result as string;
          setLogos(newLogos);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addLogoSlot = () => {
    if (logos.length < 5) {
      setLogos([...logos, null]);
    }
  };

  const removeLogoSlot = (index: number) => {
    if (index >= 3) {
      const newLogos = logos.filter((_, i) => i !== index);
      setLogos(newLogos);
    }
  };


  const downloadImage = async () => {
    if (!previewRef.current) return;
    setIsDownloading(true);
    try {
      // Scale up from 672px preview to 1080px output (ratio = 1080/672 ≈ 1.607)
      const pixelRatio = 1080 / 672;
      const dataUrl = await toPng(previewRef.current, {
        pixelRatio,
        cacheBust: true,
        width: 672,
        height: 838,
        style: {
          borderRadius: '0',
          border: 'none',
          boxShadow: 'none',
          margin: '0',
          transform: 'none',
        },
      });
      const link = document.createElement('a');
      link.download = `ispu-banjarmasin-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
      alert('Gagal mengunduh gambar. Silakan coba lagi.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center font-sans">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-sky-600 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold">Memuat data Kualitas Udara (ISPU)...</p>
        </div>
      </div>
    );
  }

  const row = ispuData?.rows[0];
  if (!row) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center font-sans">
        <div className="text-center p-6 bg-white rounded-xl shadow-lg">
          <p className="text-red-500 font-bold mb-4">Gagal memuat data kualitas udara.</p>
          <button onClick={fetchIspuData} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const pm10Val = parseInt(row.pm10) || 0;
  const pm25Val = parseInt(row.pm25) || 0;
  const so2Val = parseInt(row.so2) || 0;
  const coVal = parseInt(row.co) || 0;
  const o3Val = parseInt(row.o3) || 0;
  const no2Val = parseInt(row.no2) || 0;
  const hcVal = parseInt(row.hc) || 0;

  const ispuValue = Math.max(pm10Val, pm25Val, so2Val, coVal, o3Val, no2Val, hcVal);
  const pollutants = [
    { key: 'pm10', name: 'PM10', label: 'Partikulat PM10', val: row.pm10 },
    { key: 'pm25', name: 'PM2.5', label: 'Partikulat PM2.5', val: row.pm25 },
    { key: 'so2', name: 'SO2', label: 'Sulfur Dioksida', val: row.so2 },
    { key: 'co', name: 'CO', label: 'Karbon Monoksida', val: row.co },
    { key: 'o3', name: 'O3', label: 'Ozon', val: row.o3 },
    { key: 'no2', name: 'NO2', label: 'Nitrogen Dioksida', val: row.no2 },
    { key: 'hc', name: 'HC', label: 'Hidrokarbon', val: row.hc }
  ];

  const dominantPollutant = pollutants.reduce((max, p) => (parseInt(p.val) || 0) > (parseInt(max.val) || 0) ? p : max, pollutants[0]);
  const catDetails = getCategoryDetails(row.kategori.nilai);
  const activeColor = row.kategori.color || catDetails.warna;
  const arrowIndex = catDetails.arrowIndex;

  const waktuParts = (row.waktu || '').split(' ');
  const activeDate = waktuParts[0] ? waktuParts[0].replace(/-/g, ' ') : '08 Juli 2026';
  const activeTime = waktuParts[1] ? waktuParts[1].substring(0, 5) : '09:00';

  const categoriesList = [
    { name: 'BERBAHAYA', color: '#000000', textColor: '#FFFFFF' },
    { name: 'SANGAT TIDAK SEHAT', color: '#ff0000', textColor: '#FFFFFF' },
    { name: 'TIDAK SEHAT', color: '#ffff00', textColor: '#1e293b' },
    { name: 'SEDANG', color: '#0000ff', textColor: '#FFFFFF' },
    { name: 'BAIK', color: '#00cc00', textColor: '#FFFFFF' }
  ];

  // Build preview background style based on bgMode and bgColor
  const previewBgStyle: React.CSSProperties = !backgroundImage
    ? bgMode === 'solid'
      ? { backgroundColor: bgColor1 }
      : { backgroundImage: `linear-gradient(to bottom, ${bgColor1} 0%, ${bgColor2} 100%)` }
    : {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 to-sky-200 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* Header Controls */}
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left w-full md:w-auto">
              <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                <h1 className="text-xl md:text-3xl font-bold text-gray-800 font-sans">Generator ISPU BPBD</h1>
                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded">Live</span>
              </div>
              <p className="text-gray-600 mt-1 text-sm md:text-base">Mendesain Infografis Sesuai Format Resmi</p>
            </div>

            <div className="flex flex-wrap w-full md:w-auto justify-center gap-2 sm:gap-3">
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                ← Prakiraan Cuaca
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Upload Background
              </button>
              <button
                onClick={fetchIspuData}
                className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={downloadImage}
                className="w-full sm:w-auto sm:flex-none flex justify-center items-center gap-1.5 px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Download Gambar
              </button>
            </div>
          </div>

          {/* Settings Custom Warning */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 mb-2 font-sans">⚠️ Edit Deskripsi Teks Kebakaran Hutan</h3>
            <textarea
              rows={2}
              value={warningText}
              onChange={(e) => setWarningText(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none"
              placeholder="Masukkan keterangan dampak kebakaran hutan dan lahan..."
            />
          </div>

          {/* Default Background Color Picker (only when no image uploaded) */}
          {!backgroundImage && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-800 mb-3 font-sans">🎨 Warna Background Default</h3>
              <div className="flex flex-wrap items-center gap-4">
                {/* Mode Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setBgMode('gradient')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${bgMode === 'gradient'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Gradient
                  </button>
                  <button
                    onClick={() => setBgMode('solid')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${bgMode === 'solid'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Solid
                  </button>
                </div>

                {/* Color 1 */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600">
                    {bgMode === 'gradient' ? 'Warna Atas:' : 'Warna:'}
                  </label>
                  <div className="relative">
                    <input
                      type="color"
                      value={bgColor1}
                      onChange={(e) => setBgColor1(e.target.value)}
                      className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-mono">{bgColor1}</span>
                </div>

                {/* Color 2 (only for gradient) */}
                {bgMode === 'gradient' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-600">Warna Bawah:</label>
                    <div className="relative">
                      <input
                        type="color"
                        value={bgColor2}
                        onChange={(e) => setBgColor2(e.target.value)}
                        className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                      />
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{bgColor2}</span>
                  </div>
                )}

                {/* Preview swatch */}
                <div
                  className="w-24 h-9 rounded-lg border border-gray-200 shadow-inner flex-shrink-0"
                  style={bgMode === 'solid'
                    ? { backgroundColor: bgColor1 }
                    : { backgroundImage: `linear-gradient(to right, ${bgColor1}, ${bgColor2})` }
                  }
                />

                {/* Reset */}
                <button
                  onClick={() => { setBgColor1('#BFEFFF'); setBgColor2('#4FA8D4'); setBgMode('gradient'); }}
                  className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Text Color Pickers */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 mb-3 font-sans">🖊️ Warna Teks</h3>
            <div className="flex flex-wrap gap-6">
              {/* Title color */}
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: titleColor }}
                />
                <label className="text-xs font-medium text-gray-600">INFO &amp; KUALITAS UDARA:</label>
                <input
                  type="color"
                  value={titleColor}
                  onChange={(e) => setTitleColor(e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                />
                <span className="text-xs text-gray-500 font-mono">{titleColor}</span>
                <button
                  onClick={() => setTitleColor('#0F2C59')}
                  className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
                >
                  Reset
                </button>
              </div>

              {/* Tagline + Sumber color */}
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: taglineColor }}
                />
                <label className="text-xs font-medium text-gray-600">Tagline &amp; Sumber:</label>
                <input
                  type="color"
                  value={taglineColor}
                  onChange={(e) => setTaglineColor(e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                />
                <span className="text-xs text-gray-500 font-mono">{taglineColor}</span>
                <button
                  onClick={() => setTaglineColor('#065F46')}
                  className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Grid Settings */}
          {backgroundImage && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-6 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700 font-sans">Tampilkan Grid Overlay</span>
              </label>

              {showGrid && (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 font-sans">Ukuran Grid:</label>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="10"
                    value={gridSize}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    className="w-32 accent-blue-600"
                  />
                  <span className="text-sm text-gray-600 w-12">{gridSize}px</span>
                </div>
              )}
            </div>
          )}

          {/* Gradient Overlay Settings */}
          {backgroundImage && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gradientEnabled}
                    onChange={(e) => setGradientEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700 font-sans">Overlay Gradient (Top → Bottom)</span>
                </label>

                {gradientEnabled && (
                  <div className="flex items-center gap-4 flex-wrap ml-6">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700 font-sans">Warna:</label>
                      <input
                        type="color"
                        value={gradientColor}
                        onChange={(e) => setGradientColor(e.target.value)}
                        className="w-10 h-8 rounded cursor-pointer"
                      />
                      <span className="text-xs text-gray-600">{gradientColor}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-gray-700 font-sans">Opacity:</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={gradientOpacity}
                        onChange={(e) => setGradientOpacity(Number(e.target.value))}
                        className="w-32"
                      />
                      <span className="text-sm text-gray-600 w-12">{gradientOpacity}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logo Upload Section */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 font-sans">📸 Logo Header</h3>
              <button
                onClick={addLogoSlot}
                className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                + Tambah Logo
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {logos.map((logo, index) => (
                <div key={index} className="relative">
                  <div
                    onClick={() => logoInputRefs.current[index]?.click()}
                    className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-3 flex flex-col items-center justify-center h-24 transition-colors bg-gray-50 hover:bg-gray-100"
                  >
                    {logo ? (
                      <img
                        src={logo}
                        alt={`Logo ${index + 1}`}
                        className="max-w-12 max-h-12 object-contain"
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-full ${index === 0 ? 'bg-yellow-400' :
                        index === 1 ? 'bg-orange-500' :
                          index === 2 ? 'bg-blue-600' :
                            index === 3 ? 'bg-green-500' :
                              index === 4 ? 'bg-pink-500' :
                                'bg-cyan-500'
                        }`}></div>
                    )}
                    <span className="text-xs text-gray-600 mt-1">Logo {index + 1}</span>
                  </div>
                  {index >= 3 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLogoSlot(index);
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  )}
                  <input
                    ref={(el) => { logoInputRefs.current[index] = el; }}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoUpload(index, e)}
                    className="hidden"
                  />
                </div>
              ))}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

         {/* Scaled Preview: 672px width and 838px height (scales 1080x1348px layout exactly by 0.62) */}
        <div className="w-full overflow-x-auto pb-8">
          <div
            ref={previewRef}
            className="relative rounded-xl shadow-2xl overflow-hidden mx-auto border border-gray-300"
            style={{
              minWidth: '672px',
              maxWidth: '672px',
              ...(backgroundImage
                ? {
                  backgroundImage: `url(${backgroundImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
                : previewBgStyle
              ),
              height: '838px'
            }}
          >
            {/* Blur */}
            <div className="absolute inset-0 backdrop-blur-[3px] bg-white/10 z-0"></div>

            {/* Grid Overlay */}
            {backgroundImage && showGrid && (
              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  pointerEvents: 'none',
                  backgroundImage: `
                    repeating-linear-gradient(
                      0deg,
                      transparent,
                      transparent ${gridSize - 1}px,
                      rgba(150, 150, 150, 0.35) ${gridSize - 1}px,
                      rgba(150, 150, 150, 0.35) ${gridSize}px
                    ),
                    repeating-linear-gradient(
                      90deg,
                      transparent,
                      transparent ${gridSize - 1}px,
                      rgba(150, 150, 150, 0.35) ${gridSize - 1}px,
                      rgba(150, 150, 150, 0.35) ${gridSize}px
                    )
                  `,
                  backgroundSize: `${gridSize}px ${gridSize}px`
                }}
              />
            )}

            {/* Infographic Main Panel */}
            <div className="relative p-6 z-20 flex flex-col justify-between h-full text-slate-800 select-none">

              {/* HEADER SECTION */}
              <div className="flex justify-between items-center h-[56px]">
                {/* Left: Logos */}
                <div className="flex items-center gap-1.5">
                  <img src={logos[0] || pemkoLogo} className="w-[46px] h-[46px] object-contain" alt="Logo Pemko" />

                  {logos[1] ? (
                    <img src={logos[1] || yaLogo} className="w-[50px] h-[28px] object-contain" alt="Logo Maju" />
                  ) : (
                    <div className="w-[50px] h-[30px] bg-black border border-white flex flex-col items-center justify-center p-0.5 shadow-sm rounded-sm">
                      <span className="text-[3px] text-white tracking-widest leading-none font-bold uppercase">Banjarmasin</span>
                      <span className="text-[5px] text-red-500 font-extrabold leading-none italic uppercase">MAJU</span>
                      <span className="text-[4px] text-white font-extrabold leading-none uppercase">SEJAHTERA</span>
                    </div>
                  )}

                  <img src={logos[2] || bpbdLogo} className="w-[46px] h-[46px] object-contain" alt="Logo BPBD" />
                  <img src={logos[3] || logo112} className="w-[46px] h-[46px] object-contain" alt="Logo 112" />
                </div>

                {/* Right: Station & Calendar Cards */}
                <div className="flex gap-2">
                  {/* Station detail */}
                  <div className="bg-white rounded-lg p-1.5 px-2 flex items-center gap-2 shadow-sm border border-gray-100 w-[190px]">
                    <div className="w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-[8px] text-white">📍</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-900 leading-none">Stasiun Kayu Tangi</p>
                      <p className="text-[8px] text-slate-500 leading-normal mt-0.5 truncate">Kantor Dinas PUPR</p>
                      <p className="text-[7.5px] text-slate-400 leading-none truncate">Jl. KH. Hasan Basri, BJM</p>
                    </div>
                  </div>

                  {/* Calendar / clock */}
                  <div className="bg-white rounded-lg p-1.5 px-2.5 flex items-center gap-2 shadow-sm border border-gray-100 w-[145px]">
                    <div className="w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-[8px] text-white">📅</span>
                    </div>
                    <div>
                      <p className="text-[9.5px] font-black text-slate-900 leading-none">{activeDate}</p>
                      <p className="text-[10px] font-extrabold text-red-500 leading-none mt-1">{activeTime} WITA</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* BODY SECTION (Double-column) */}
              <div className="flex gap-4 items-stretch flex-grow mt-3 min-h-0">

                {/* LEFT COLUMN (Info, Artinya box, Fire warning box, Green note pill) */}
                <div className="w-[285px] flex flex-col justify-between">
                  {/* Title Header */}
                  <div>
                    <div className="flex items-start gap-1">
                      <span
                        className="text-[68px] font-black tracking-tighter leading-none"
                        style={{ color: titleColor }}
                      >INFO</span>
                      <div className="flex flex-col" style={{ paddingTop: '2px' }}>
                        <span
                          className="text-[26px] font-black tracking-tight leading-none"
                          style={{ color: titleColor }}
                        >KUALITAS</span>
                        <span
                          className="text-[26px] font-black tracking-tight leading-none mt-0.5"
                          style={{ color: titleColor }}
                        >UDARA</span>
                      </div>
                    </div>
                    {/* green pill */}
                    <div className="bg-[#0D7C34] text-white text-[15px] font-black tracking-wider text-center py-1 rounded-md mt-1 shadow-sm uppercase">
                      KOTA BANJARMASIN
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 font-medium">
                      Berdasarkan hasil pemantauan di <span className="font-bold text-[#0F2C59]">Stasiun Kayu Tangi</span>
                    </p>
                  </div>

                  {/* APA ARTINYA? Box */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-[215px]">
                    <div className="bg-[#0F2C59] text-white text-[10px] font-black text-center py-1 uppercase tracking-wider">
                      APA ARTINYA?
                    </div>
                    <div className="p-2.5 flex flex-col justify-between flex-grow min-h-0 text-[11px]">
                      {/* block 1 category info */}
                      <div className="flex gap-2.5 items-start">
                        <div className="w-[30px] h-[30px] bg-blue-500 rounded-full flex items-center justify-center text-white flex-shrink-0 font-bold shadow-sm">
                          🛡️
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-[14px] font-black leading-none uppercase mb-1" style={{ color: activeColor }}>
                            {row.kategori.nilai}
                          </h4>
                          <p className="text-slate-600 leading-normal line-clamp-3">
                            {row.kategori.keterangan || catDetails.artinya}
                          </p>
                        </div>
                      </div>

                      {/* block 2 group sensitive info */}
                      <div className="flex gap-2.5 items-start border-t border-slate-100 pt-2.5">
                        <div className="w-[30px] h-[30px] bg-blue-500 rounded-full flex items-center justify-center text-blue-500 flex-shrink-0 font-bold shadow-sm border border-blue-100">
                          🫁
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-black text-[#1E3A8A] leading-tight">
                            Kelompok sensitif (anak-anak, lansia, ibu hamil, & penderita asma):
                          </h5>
                          <p className="text-slate-500 leading-normal mt-0.5 line-clamp-3">
                            {catDetails.kelompokSensitif}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FIRE IMPACT Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-[145px]">
                    <div className="bg-[#0D7C34] text-white text-[9.5px] font-black text-center py-1 uppercase tracking-wide">
                      WASPADAI DAMPAK KEBAKARAN LAHAN
                    </div>
                    <div className="p-2.5 flex items-start gap-2.5 flex-grow">
                      <span className="text-3xl select-none flex-shrink-0">🔥</span>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium line-clamp-4">
                        {warningText}
                      </p>
                    </div>
                  </div>

                  {/* Note alert pill */}
                  <div className="bg-[#E8F5E9] rounded-lg p-2 flex items-center gap-2 border border-[#C8E6C9] h-[62px]">
                    <div className="w-5 h-5 rounded-full bg-[#0D7C34] flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                      !
                    </div>
                    <p className="text-[8.5px] text-[#1B5E20] font-black leading-tight line-clamp-3">
                      {catDetails.note}
                    </p>
                  </div>
                </div>

                {/* RIGHT COLUMN (ISPU Badge, definitions, bar chart stack, tips) */}
                <div className="w-[325px] flex flex-col justify-between">
                  {/* ISPU Main Badge — background color from API kategori.color */}
                  <div
                    className="rounded-xl p-2.5 text-white flex items-center h-[125px]"
                    style={{ backgroundColor: activeColor }}
                  >
                    {/* Left: Value */}
                    <div className="w-[125px] text-center border-r border-white/20 flex flex-col justify-center">
                      <p
                        className="text-[14px] font-black tracking-wide leading-none"
                        style={{ color: getContrastColor(activeColor), opacity: 0.85 }}
                      >
                        ISPU
                      </p>
                      <h2
                        className="text-[60px] font-black leading-none mt-1.5"
                        style={{ color: getContrastColor(activeColor) }}
                      >
                        {ispuValue}
                      </h2>
                    </div>

                    {/* Right: Category and label info */}
                    <div className="flex-1 pl-4 flex flex-col justify-center">
                      <h3
                        className="text-[28px] font-black uppercase leading-tight tracking-tight"
                        style={{ color: getContrastColor(activeColor) }}
                      >
                        {row.kategori.nilai}
                      </h3>
                      <div
                        className="rounded-md py-1 px-2 mt-1.5 text-[9.5px] font-extrabold tracking-wide text-center"
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.15)',
                          color: getContrastColor(activeColor)
                        }}
                      >
                        {dominantPollutant.name}  |  {row.waktu}
                      </div>
                    </div>
                  </div>

                  {/* PM10 / PM2.5 definition boxes */}
                  <div className="flex gap-2">
                    {/* PM10 Card */}
                    <div className="bg-white rounded-lg p-1.5 flex-1 shadow-sm border border-gray-100 border-l-[3.5px] border-l-blue-500 h-[48px] flex flex-col justify-center">
                      <h4 className="text-[9.5px] font-black text-[#0F2C59] leading-none">PM10 (Debu Halus)</h4>
                      <p className="text-[7.5px] text-slate-500 leading-none mt-1.5">Partikel berukuran ≤ 10 µm</p>
                    </div>

                    {/* PM2.5 Card */}
                    <div className="bg-white rounded-lg p-1.5 flex-1 shadow-sm border border-gray-100 border-l-[3.5px] border-l-blue-500 h-[48px] flex flex-col justify-center">
                      <h4 className="text-[9.5px] font-black text-[#0F2C59] leading-none">PM2.5 (Debu Sangat Halus)</h4>
                      <p className="text-[7.5px] text-slate-500 leading-none mt-1.5">Partikel berukuran ≤ 2,5 µm</p>
                    </div>
                  </div>

                  {/* Legend & Bar Chart Card */}
                  <div className="bg-white rounded-xl p-2.5 shadow-sm border border-gray-100 flex flex-col h-[178px] justify-between">
                    <span className="text-[9px] font-black text-slate-400 tracking-wider">KATEGORI</span>

                    <div className="flex gap-2 items-center flex-grow mt-1">
                      {/* Left: Legend stack */}
                      <div className="flex flex-col gap-0.5 w-[76px] flex-shrink-0 relative">
                        {categoriesList.map((cat, idx) => (
                          <div
                            key={cat.name}
                            className="text-[6.5px] font-black text-center py-1 rounded text-white relative leading-none border border-black/5"
                            style={{
                              backgroundColor: cat.color,
                              color: cat.textColor
                            }}
                          >
                            {cat.name}
                            {arrowIndex === idx && (
                              <div
                                className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[3.5px] border-t-transparent border-b-[3.5px] border-b-transparent border-l-[5px]"
                                style={{ borderLeftColor: cat.color }}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Right: Vertical Bar Chart */}
                      <div className="flex-1 flex flex-col justify-between h-full min-w-0">
                        {/* Bars container */}
                        <div className="flex items-end justify-between h-[92px] pt-1 px-1 flex-grow">
                          {pollutants.map((p) => {
                            const valNum = parseInt(p.val) || 0;
                            const barHeight = Math.min(100, Math.max(4, (valNum / 300) * 100)); // scale out of 300
                            const barColor = getIspuColor(valNum);
                            return (
                              <div key={p.key} className="flex flex-col items-center flex-1">
                                <span className="text-[8px] font-extrabold text-slate-800 mb-0.5 leading-none">{p.val}</span>
                                <div className="w-2.5 bg-slate-100 rounded-t h-[65px] flex items-end">
                                  <div
                                    className="w-full rounded-t transition-all duration-500"
                                    style={{ height: `${barHeight}%`, backgroundColor: barColor }}
                                  />
                                </div>
                                <span className="text-[8px] font-black text-slate-500 mt-1 leading-none">{p.name}</span>
                              </div>
                            );
                          })}
                        </div>
                        <span className="text-[7.5px] text-slate-400 font-medium tracking-wide mt-1 block">
                          *ISPU : Indeks Standar Pencemar Udara
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TIPS MENJAGA KESEHATAN Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-[215px]">
                    <div className="bg-[#0F2C59] text-white text-[10px] font-black text-center py-1 uppercase tracking-wide">
                      TIPS MENJAGA KESEHATAN
                    </div>
                    <div className="p-2 flex flex-col justify-between flex-grow min-h-0 text-[12px]">
                      {tipsList.map((tip, idx) => (
                        <div key={idx} className={`flex gap-2 items-center flex-grow py-1 ${idx > 0 ? 'border-t border-slate-50' : ''}`}>
                          <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-xs shadow-sm">
                            {tip.em}
                          </div>
                          <p className="text-slate-700 leading-snug font-medium line-clamp-2">
                            {tip.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* FOOTER SECTION */}
              <div className="mt-3">
                <div className="flex justify-between items-end mb-1">
                  <p className="text-[9px] font-bold opacity-90" style={{ color: taglineColor }}>
                    Sumber: {row.tipe_text} &amp; ispu.kemenlh.go.id
                  </p>
                  <p className="font-black italic text-xs flex items-center gap-1" style={{ color: taglineColor }}>
                    <span>Udara Bersih Untuk Kita Semua 🍃</span>
                  </p>
                </div>

                {/* Unified dark blue footer */}
                <div className="bg-[#0F2C59] text-white rounded-lg p-2 flex flex-col gap-1.5 shadow-md">
                  <div className="flex justify-between items-center">
                    {/* Left text */}
                    <div className="text-[10px] font-black leading-snug w-[360px] opacity-95">
                      MARI BERSAMA-SAMA MENJAGA KUALITAS UDARA DENGAN TIDAK MELAKUKAN PEMBAKARAN LAHAN MAUPUN SAMPAH SERTA MENDUKUNG UPAYA PENCEGAHAN KEBAKARAN HUTAN DAN LAHAN.
                    </div>

                    {/* Right Red 112 Badge */}
                    <div className="bg-red-500 rounded-md p-1 px-3 text-center text-white flex flex-col justify-center flex-shrink-0 w-[150px] shadow">
                      <span className="text-[6.5px] font-black uppercase opacity-90 tracking-wide leading-none">Call Center Darurat</span>
                      <span className="text-lg font-black leading-none mt-0.5">112</span>
                      <span className="text-[6.5px] font-bold opacity-80 leading-none">(Bebas Pulsa)</span>
                    </div>
                  </div>

                  {/* Horizontal Line */}
                  <div className="border-t border-white/10 w-full" />

                  {/* Bottom Handles */}
                  <div className="flex justify-between text-[8px] font-black opacity-90 px-1 mt-0.5">
                    <span>🌐  bpbd.banjarmasinkota.go.id</span>
                    <span>📸  bpbd_kota_banjarmasin</span>
                    <span>📩  bpbdk.bjm3@gmail.com</span>
                    <span>📞  0851-8889-1117</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Info Card */}
        <div className="mt-4 bg-white rounded-lg p-6 shadow-lg max-w-2xl mx-auto">
          <h3 className="font-bold text-gray-800 mb-3">📋 Fitur Desain Infografis Baru</h3>
          <ul className="text-sm text-gray-700 space-y-2.5">
            <li>✅ <strong>Layout Dua Kolom:</strong> Kolom kiri menampilkan penjelasan klasifikasi ISPU, sedangkan kolom kanan menampilkan visualisasi grafik dan tips kesehatan.</li>
            <li>✅ <strong>Logo Call Center 112:</strong> Tombol emergency merah 112 di kanan bawah dan logo 112 di header.</li>
            <li>✅ <strong>Warna Kategori Sinkron:</strong> Teks kategori ("BAIK", "SEDANG", dll.) dan lingkaran diubah warnanya secara otomatis mengikuti API dari KLHK.</li>
            <li>✅ <strong>Diagram Batang Kategori:</strong> Grafik visual 7 parameter gas/partikel dengan status warna yang sesuai. Stack legend di sampingnya menunjukkan tingkat kategori lengkap dengan panah penunjuk.</li>
            <li>✅ <strong>Waktu & Tanggal Berformat:</strong> Teks waktu dan tanggal pengukuran terpisah dengan ikon kalender dan map pin di header kanan.</li>
          </ul>
        </div>

      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default AirQuality;
