import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Upload, RefreshCw, Clock } from 'lucide-react';
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
  vs_text: string;
  [key: string]: unknown;
}

interface WeatherData {
  data: Array<{
    cuaca: ForecastItem[][];
  }>;
}

const WeatherForecast = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState(50);
  const [showGrid, setShowGrid] = useState(true);
  const [logos, setLogos] = useState<(string | null)[]>([pemkoLogo, yaLogo, bpbdLogo, logo112]);
  const [gradientEnabled, setGradientEnabled] = useState(false);
  const [gradientColor, setGradientColor] = useState('#000000');
  const [gradientOpacity, setGradientOpacity] = useState(50);
  const [startHour, setStartHour] = useState(12);
  const [hourInterval, setHourInterval] = useState(3);
  const [warningText, setWarningText] = useState('DIPERKIRAKAN CUACA BANJARMASIN DAN SEKITARNYA AKAN CERAH BERAWAN');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fetchWeatherData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=63.71.05.1001');
      const data = await response.json();
      setWeatherData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching weather data:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const date = new Date(dateStr);
    return `${days[date.getDay()].toUpperCase()}, ${date.getDate()} ${months[date.getMonth()].toUpperCase()} ${date.getFullYear()}`;
  };

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

  const getTodayForecasts = () => {
    if (!weatherData || !weatherData.data || !weatherData.data[0]) return [];

    const allForecasts = weatherData.data[0].cuaca.flat();
    if (allForecasts.length === 0) return [];

    // Patokan dari data API pertama
    const firstForecast = new Date(allForecasts[0].datetime);

    // Konversi ke WITA (UTC+8) agar sesuai dengan UI yang diminta (Banjarmasin)
    const witaOffset = 8 * 60 * 60 * 1000;
    const baseWitaDate = new Date(firstForecast.getTime() + witaOffset);

    // Setel jam di zona WITA sesuai dengan startHour yang diinput (mengabaikan menit/detik)
    baseWitaDate.setUTCHours(startHour, 0, 0, 0);

    // Kembalikan menjadi waktu UTC yang sesungguhnya untuk patokan loop interval
    let currentTargetUtc = new Date(baseWitaDate.getTime() - witaOffset);

    // Berhenti saat berganti hari di zona waktu lokal (WITA)
    const startDayWita = baseWitaDate.getUTCDate();

    // Waktu realtime saat ini di WITA untuk mengecek jam yang terlewat
    const nowUtc = new Date();
    const nowWita = new Date(nowUtc.getTime() + witaOffset);
    const todayWitaYear = nowWita.getUTCFullYear();
    const todayWitaMonth = nowWita.getUTCMonth();
    const todayWitaDate = nowWita.getUTCDate();
    const currentWitaHour = nowWita.getUTCHours();

    const result = [];

    // Loop maksimal 6 kali mengisi data, atau berhenti setelah 24 kali cek
    let iterations = 0;
    while (result.length < 6 && iterations < 24) {
      iterations++;

      // Cek apakah tanggal target saat ini sudah beda hari dalam waktu WITA
      const checkWitaDate = new Date(currentTargetUtc.getTime() + witaOffset);
      if (checkWitaDate.getUTCDate() !== startDayWita) {
        break; // Stop loop karena tidak boleh melewati 23:59 WITA di hari ini
      }

      // Mengecek apakah jam target saat ini sudah lewat dibandingkan waktu riil sekarang (WITA)
      let isPastHour = false;
      if (
        checkWitaDate.getUTCFullYear() === todayWitaYear &&
        checkWitaDate.getUTCMonth() === todayWitaMonth &&
        checkWitaDate.getUTCDate() === todayWitaDate &&
        checkWitaDate.getUTCHours() < currentWitaHour
      ) {
        isPastHour = true;
      }

      // Jika waktu sudah terlewat, lewati dan lompat ke interval berikutnya
      if (isPastHour) {
        currentTargetUtc = new Date(currentTargetUtc.getTime() + hourInterval * 60 * 60 * 1000);
        continue;
      }

      // Cari set data prakiraan yang jam-nya paling mendekati target yang dibuat (interpolation proxy)
      let closestForecast: ForecastItem | null = null;
      let minDiff = Infinity;

      allForecasts.forEach((f: ForecastItem) => {
        const fDate = new Date(f.datetime);
        const diff = Math.abs(fDate.getTime() - currentTargetUtc.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestForecast = f;
        }
      });

      const found: ForecastItem | null = closestForecast;
      if (found) {
        result.push({
          ...(found as ForecastItem),
          // Manipulasi original datetime dari API menggunakan jam target buatan kita yang sudah sesuai dengan start dan interval 
          datetime: currentTargetUtc.toISOString(),
          local_datetime: currentTargetUtc.toISOString(), // jaga-jaga apabila dipakai di fungsi lain
        });
      }

      // Increment jam target sesuai dengan interval yang ditentukan (1 - 6 jam)
      currentTargetUtc = new Date(currentTargetUtc.getTime() + hourInterval * 60 * 60 * 1000);
    }

    return result;
  };

  const downloadImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = 1080;
    const height = 1348;

    canvas.width = width;
    canvas.height = height;

    // Draw background
    if (backgroundImage) {
      const img = new Image();
      img.src = backgroundImage;
      await new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          resolve();
        };
      });
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#87CEEB');
      gradient.addColorStop(1, '#98D8E8');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    // Apply blur effect overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, 0, width, height);

    // Apply gradient overlay if enabled
    if (gradientEnabled) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      const r = parseInt(gradientColor.slice(1, 3), 16);
      const g = parseInt(gradientColor.slice(3, 5), 16);
      const b = parseInt(gradientColor.slice(5, 7), 16);
      const opacity = gradientOpacity / 100;

      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    // Draw grid overlay if enabled
    if (showGrid && backgroundImage) {
      ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([10, 10]);

      // Vertical lines
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    // Draw logos
    const logoY = 60;
    const logoSize = 80;
    const logoGap = 20;
    const totalLogoWidth = (logoSize * logos.length) + (logoGap * (logos.length - 1));
    const logoStartX = (width - totalLogoWidth) / 2;

    for (let i = 0; i < logos.length; i++) {
      const xPos = logoStartX + i * (logoSize + logoGap);

      if (logos[i]) {
        // Draw uploaded logo with auto-resize
        const logoImg = new Image();
        logoImg.src = logos[i] as string;
        await new Promise<void>((resolve) => {
          logoImg.onload = () => {
            // Calculate aspect ratio and fit within logoSize
            const aspectRatio = logoImg.width / logoImg.height;
            let drawWidth = logoSize;
            let drawHeight = logoSize;
            let offsetX = 0;
            let offsetY = 0;

            if (aspectRatio > 1) {
              // Wider than tall
              drawHeight = logoSize / aspectRatio;
              offsetY = (logoSize - drawHeight) / 2;
            } else {
              // Taller than wide
              drawWidth = logoSize * aspectRatio;
              offsetX = (logoSize - drawWidth) / 2;
            }

            ctx.drawImage(logoImg, xPos + offsetX, logoY + offsetY, drawWidth, drawHeight);
            resolve();
          };
          if (logoImg.complete) {
            const aspectRatio = logoImg.width / logoImg.height;
            let drawWidth = logoSize;
            let drawHeight = logoSize;
            let offsetX = 0;
            let offsetY = 0;

            if (aspectRatio > 1) {
              drawHeight = logoSize / aspectRatio;
              offsetY = (logoSize - drawHeight) / 2;
            } else {
              drawWidth = logoSize * aspectRatio;
              offsetX = (logoSize - drawWidth) / 2;
            }

            ctx.drawImage(logoImg, xPos + offsetX, logoY + offsetY, drawWidth, drawHeight);
            resolve();
          }
        });
      } else {
        // Draw default colored circle
        const colors = ['#FFD700', '#FF8C00', '#4169E1', '#32CD32', '#FF1493', '#00CED1'];
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(xPos + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Header text
    ctx.fillStyle = '#2C3E50';
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BADAN PENANGGULANGAN BENCANA DAERAH', width / 2, 200);
    ctx.fillText('KOTA BANJARMASIN', width / 2, 235);

    // Main title
    ctx.font = 'bold 75px Arial';
    ctx.fillStyle = '#2C3E50';
    ctx.fillText('PRAKIRAAN CUACA', width / 2, 330);

    const forecasts = getTodayForecasts();
    const firstForecastDate = forecasts[0]?.local_datetime || new Date().toISOString();

    // Subtitle with date
    ctx.font = '32px Arial';
    ctx.fillStyle = '#2C3E50';
    ctx.fillText(`KOTA BANJARMASIN, ${formatDateIndonesian(firstForecastDate)}`, width / 2, 380);

    // Weather cards
    const cardWidth = 300;
    const cardHeight = 310;
    const gapX = 40;
    const gapY = 30;
    const startY = 415;

    // Menghitung formasi posisi grid kartu
    const cardPositions: { x: number, y: number }[] = [];
    if (forecasts.length === 4) {
      // Formasi 2x2
      for (let i = 0; i < 4; i++) {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const rowWidth = 2 * cardWidth + gapX;
        const startXRow = (width - rowWidth) / 2;
        cardPositions.push({ x: startXRow + col * (cardWidth + gapX), y: startY + row * (cardHeight + gapY) });
      }
    } else if (forecasts.length === 5) {
      // Formasi 3 atas, 2 tengah bawah
      for (let i = 0; i < 5; i++) {
        const row = i < 3 ? 0 : 1;
        const col = i < 3 ? i : (i - 3);
        const limitInRow = i < 3 ? 3 : 2;
        const rowWidth = limitInRow * cardWidth + (limitInRow - 1) * gapX;
        const startXRow = (width - rowWidth) / 2;
        cardPositions.push({ x: startXRow + col * (cardWidth + gapX), y: startY + row * (cardHeight + gapY) });
      }
    } else {
      // Default / Formasi normal
      let totalAssigned = 0;
      let currentRow = 0;
      while (totalAssigned < forecasts.length) {
        const countInRow = Math.min(3, forecasts.length - totalAssigned);
        const rowWidth = countInRow * cardWidth + (countInRow - 1) * gapX;
        const startXRow = (width - rowWidth) / 2;
        for (let col = 0; col < countInRow; col++) {
          cardPositions.push({ x: startXRow + col * (cardWidth + gapX), y: startY + currentRow * (cardHeight + gapY) });
        }
        totalAssigned += countInRow;
        currentRow++;
      }
    }

    forecasts.forEach((forecast, index) => {
      const { x, y } = cardPositions[index];

      // Card background with blur
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.roundRect(x, y, cardWidth, cardHeight, 20);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Time
      ctx.fillStyle = '#2C3E50';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${formatTime(forecast.datetime)} WITA`, x + cardWidth / 2, y + 35);

      // Weather icon
      ctx.font = '80px Arial';
      ctx.fillText(getWeatherIcon(forecast.weather), x + cardWidth / 2, y + 115);

      // Temperature
      ctx.font = 'bold 60px Arial';
      ctx.fillStyle = '#2C3E50';
      ctx.fillText(`${forecast.t}°C`, x + cardWidth / 2, y + 180);

      // Weather description
      ctx.font = '20px Arial';
      ctx.fillStyle = '#546E7A';
      ctx.fillText(forecast.weather_desc, x + cardWidth / 2, y + 215);

      // Weather details with icons
      ctx.font = '18px Arial';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#546E7A';

      // Humidity
      ctx.fillText('💧', x + 20, y + 260);
      ctx.fillText(`${forecast.hu}%`, x + 50, y + 260);

      // Wind speed
      ctx.fillText('💨', x + 20, y + 290);
      ctx.fillText(`${Math.round(forecast.ws)} km/jam`, x + 50, y + 290);

      // Wind direction
      ctx.fillText('🧭', x + 160, y + 260);
      ctx.fillText(translateWindDirection(forecast.wd_to), x + 190, y + 260);

      // Visibility
      ctx.fillText('👁️', x + 160, y + 290);
      ctx.fillText(forecast.vs_text, x + 190, y + 290);
    });

    // Warning section
    let maxCardY = startY;
    if (cardPositions.length > 0) {
      maxCardY = Math.max(...cardPositions.map(p => p.y));
    }
    const warningY = maxCardY + cardHeight + 35; // increased top padding (from +15 to +35)

    // Sumber Data text
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 4;
    ctx.font = 'italic 18px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('Sumber Data : BMKG Indonesia', width - 60, warningY - 5); // adjusted y offset
    ctx.shadowBlur = 0; // reset shadow

    // Warning title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PERINGATAN :', width / 2, warningY + 20);

    // Warning text with Multi-line Support
    ctx.font = '22px Arial';
    const warningTextLines = [];
    const words = warningText.split(' ');
    let currentLine = '';
    const maxWidth = width - 120; // 60px padding on each side

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        warningTextLines.push(currentLine);
        currentLine = words[i] + ' ';
      } else {
        currentLine = testLine;
      }
    }
    warningTextLines.push(currentLine);

    warningTextLines.forEach((line, index) => {
      ctx.fillText(line.trim(), width / 2, warningY + 55 + (index * 30));
    });

    // Yellow warning box
    const yellowBoxY = warningY + 70 + ((warningTextLines.length - 1) * 30);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(60, yellowBoxY, width - 120, 80);

    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('HIMBAUAN AGAR TETAP WASPADA KETIKA BERAKTIVITAS DI LUAR RUANGAN.', width / 2, yellowBoxY + 35);
    ctx.fillText('DAN SELALU PANTAU PERKEMBANGAN CUACA TERKINI !', width / 2, yellowBoxY + 65);

    // Footer - Dark gray background
    const footerY = height - 60;
    ctx.fillStyle = '#3A3A3A';
    ctx.fillRect(0, footerY, width, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';

    const footerItemY = footerY + 35;
    const iconSize = 22;
    const spacing = 175;

    // Instagram icon (circle with camera)
    let xPos = 40;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(xPos, footerItemY - iconSize / 2 - 6, iconSize, iconSize, 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(xPos + iconSize / 2, footerItemY - 6, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText('bpbd_kota_banjarmasin', xPos + iconSize + 8, footerItemY);

    // // Facebook icon (f in circle)
    // xPos += spacing;
    // ctx.beginPath();
    // ctx.arc(xPos + iconSize / 2, footerItemY - 6, iconSize / 2, 0, Math.PI * 2);
    // ctx.stroke();
    // ctx.font = 'bold 14px Arial';
    // ctx.fillText('f', xPos + iconSize / 2 - 3, footerItemY - 1);
    // ctx.font = '13px Arial';
    // ctx.fillText('bpbd banjarmasin', xPos + iconSize + 8, footerItemY);

    // Phone icon
    xPos += spacing;
    ctx.beginPath();
    ctx.arc(xPos + 6, footerItemY - 10, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(xPos + 6, footerItemY - 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(xPos + 1, footerItemY - 16, 10, 20, 2);
    ctx.stroke();
    ctx.fillText('0851-8889-1117', xPos + iconSize + 3, footerItemY);

    // Email icon (envelope)
    xPos += spacing - 10;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(xPos, footerItemY - 13, 20, 13);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xPos, footerItemY - 13);
    ctx.lineTo(xPos + 10, footerItemY - 6);
    ctx.lineTo(xPos + 20, footerItemY - 13);
    ctx.stroke();
    ctx.fillText('bpbdk.bjm3@gmail.com', xPos + 26, footerItemY);

    // Website icon (globe)
    xPos += spacing + 15;
    ctx.beginPath();
    ctx.arc(xPos + 10, footerItemY - 6, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(xPos + 10, footerItemY - 6, 3, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xPos, footerItemY - 6);
    ctx.lineTo(xPos + 20, footerItemY - 6);
    ctx.stroke();
    ctx.fillText('bpbd.banjarmasinkota.go.id', xPos + 26, footerItemY);

    // Download
    const link = document.createElement('a');
    link.download = `prakiraan-cuaca-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold">Memuat data cuaca...</p>
        </div>
      </div>
    );
  }

  const forecasts = getTodayForecasts();
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
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 sm:flex-none flex justify-center items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                Upload
              </button>
              <button
                onClick={fetchWeatherData}
                className="flex-1 sm:flex-none flex justify-center items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                Refresh
              </button>
              <button
                onClick={downloadImage}
                className="w-full sm:w-auto sm:flex-none flex justify-center items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                Download
              </button>
            </div>
          </div>

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
                  <span className="text-sm font-medium text-gray-700">Overlay Gradient (Top → Bottom)</span>
                </label>

                {gradientEnabled && (
                  <div className="flex items-center gap-4 flex-wrap ml-6">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">Warna:</label>
                      <input
                        type="color"
                        value={gradientColor}
                        onChange={(e) => setGradientColor(e.target.value)}
                        className="w-10 h-8 rounded cursor-pointer"
                      />
                      <span className="text-xs text-gray-600">{gradientColor}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-gray-700">Opacity:</label>
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

          {/* Logo Upload Section */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">📸 Logo Header</h3>
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

          {/* Warning Text Setting */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 mb-3">⚠️ Teks Peringatan</h3>
            <input
              type="text"
              value={warningText}
              onChange={(e) => setWarningText(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Masukkan teks peringatan..."
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* Preview */}
        <div className="w-full overflow-x-auto pb-6">
          <div
            className="relative rounded-xl shadow-2xl overflow-hidden mx-auto z-0"
            style={{
              minWidth: '672px',
              maxWidth: '672px',
              backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'linear-gradient(to bottom, #87CEEB, #98D8E8)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Blur overlay */}
            <div className="absolute inset-0 backdrop-blur-sm bg-white/10 z-0"></div>

            {/* Gradient overlay */}
            {backgroundImage && gradientEnabled && (
              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  pointerEvents: 'none',
                  background: `linear-gradient(to bottom, ${gradientColor}${Math.round(gradientOpacity * 2.55).toString(16).padStart(2, '0')}, transparent)`
                }}
              />
            )}

            {/* Grid overlay */}
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
          rgba(150, 150, 150, 0.3) ${gridSize - 1}px,
          rgba(150, 150, 150, 0.3) ${gridSize}px
          ),
          repeating-linear-gradient(
          90deg,
          transparent,
          transparent ${gridSize - 1}px,
          rgba(150, 150, 150, 0.3) ${gridSize - 1}px,
          rgba(150, 150, 150, 0.3) ${gridSize}px
          )
          `,
                  backgroundSize: `${gridSize}px ${gridSize}px`
                }}
              >
                <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                  <defs>
                    <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                      <path
                        d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                        fill="none"
                        stroke="rgba(150, 150, 150, 0.3)"
                        strokeWidth="1"
                        strokeDasharray="10, 10"
                      />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>
            )}

            <div className="relative p-8 z-20">
              {/* Header Section */}
              <div className="text-center mb-6">
                {/* Logo placeholders */}
                <div className="flex justify-center gap-4 mb-6">
                  {logos.map((logo, index) => (
                    <div key={index} className="relative w-16 h-16 flex items-center justify-center">
                      {logo ? (
                        <img
                          src={logo}
                          alt={`Logo ${index + 1}`}
                          className="max-w-full max-h-full object-contain shadow-lg"
                        />
                      ) : (
                        <div className={`w-16 h-16 rounded-full shadow-lg ${index === 0 ? 'bg-yellow-400' :
                          index === 1 ? 'bg-orange-500' :
                            index === 2 ? 'bg-blue-600' :
                              index === 3 ? 'bg-green-500' :
                                index === 4 ? 'bg-pink-500' :
                                  'bg-cyan-500'
                          }`}></div>
                      )}
                    </div>
                  ))}
                </div>

                <h2 className="text-sm font-bold text-gray-800 mb-1">BADAN PENANGGULANGAN BENCANA DAERAH</h2>
                <h2 className="text-sm font-bold text-gray-800 mb-4">KOTA BANJARMASIN</h2>

                <h1 className="text-5xl font-black text-gray-900 mb-2">PRAKIRAAN CUACA</h1>
                <p className="text-base font-semibold text-gray-800">KOTA BANJARMASIN, {formatDateIndonesian(firstForecastDate)}</p>
              </div>

              {/* Weather Cards Grid */}
              <div className="flex flex-col gap-3 mb-6 items-center w-full">
                {(forecasts.length === 4
                  ? [forecasts.slice(0, 2), forecasts.slice(2, 4)]
                  : forecasts.length === 5
                    ? [forecasts.slice(0, 3), forecasts.slice(3, 5)]
                    : forecasts.length === 6
                      ? [forecasts.slice(0, 3), forecasts.slice(3, 6)]
                      : [forecasts]
                ).map((row, rowIndex) => (
                  <div key={rowIndex} className="flex justify-center gap-3 w-full">
                    {row.map((forecast, index) => (
                      <div
                        key={`${rowIndex}-${index}`}
                        className="bg-white/85 backdrop-blur-sm rounded-2xl p-4 shadow-lg flex-shrink-0"
                        style={{ width: 'calc(33.333% - 8px)', minWidth: '150px' }}
                      >
                        <div className="text-center">
                          <p className="font-bold text-gray-800 text-xs mb-2">{formatTime(forecast.datetime)} WITA</p>
                          <div className="text-5xl mb-2">{getWeatherIcon(forecast.weather)}</div>
                          <p className="text-3xl font-bold text-gray-900">{forecast.t}°C</p>
                          <p className="text-xs text-gray-700 mb-3">{forecast.weather_desc}</p>

                          <div className="space-y-1 text-xs text-gray-600">
                            <div className="flex items-center justify-between px-2">
                              <span>💧 {forecast.hu}%</span>
                              <span>💨 {Math.round(forecast.ws)} km/jam</span>
                            </div>
                            <div className="flex items-center justify-between px-2">
                              <span>🧭 {translateWindDirection(forecast.wd_to)}</span>
                              <span>👁️ {forecast.vs_text}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Warning Section */}
              <div className="text-center mb-6 px-4">
                <h3 className="text-white font-bold text-lg mb-2 drop-shadow-lg">PERINGATAN :</h3>
                <p className="text-white text-sm mb-3 drop-shadow-lg whitespace-pre-wrap break-words px-2 mx-auto max-w-full">
                  {warningText}
                </p>
                <div className="bg-yellow-400 rounded-lg p-4 shadow-lg w-full max-w-[95%] mx-auto">
                  <p className="text-gray-900 font-bold text-sm leading-relaxed">
                    HIMBAUAN AGAR TETAP WASPADA KETIKA BERAKTIVITAS DI LUAR RUANGAN<br />
                    DAN SELALU PANTAU PERKEMBANGAN CUACA TERKINI !
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-700 rounded-lg p-2">
                <div className="flex items-center justify-between text-xs text-white">
                  {/* Instagram */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 border-2 border-white rounded-md flex items-center justify-center">
                      <div className="w-2.5 h-2.5 border-2 border-white rounded-full"></div>
                    </div>
                    <span className="text-xs">bpbd_kota_banjarmasin</span>
                  </div>

                  {/* Facebook */}
                  {/* <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center">
                      <span className="font-bold text-xs">f</span>
                    </div>
                    <span className="text-xs">bpbd banjarmasin</span>
                  </div> */}

                  {/* Phone */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <div className="w-3 h-5 border-2 border-white rounded"></div>
                    </div>
                    <span className="text-xs">085188891117</span>
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <svg width="18" height="13" viewBox="0 0 18 13" fill="none" className="stroke-white stroke-2">
                        <rect x="1" y="1" width="16" height="11" />
                        <path d="M1 1 L9 7 L17 1" />
                      </svg>
                    </div>
                    <span className="text-xs">bpbdk.bjm3@gmail.com</span>
                  </div>

                  {/* Website */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="stroke-white stroke-2">
                        <circle cx="9" cy="9" r="7" />
                        <ellipse cx="9" cy="9" rx="2.5" ry="7" />
                        <line x1="2" y1="9" x2="16" y2="9" />
                      </svg>
                    </div>
                    <span className="text-xs">bpbd.banjarmasinkota.go.id</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-white rounded-lg p-6 shadow-lg max-w-2xl mx-auto">
          <h3 className="font-bold text-gray-800 mb-3">📋 Cara Penggunaan</h3>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>✅ <strong>Upload Background:</strong> Klik "Upload Gambar" untuk background custom</li>
            <li>✅ <strong>Upload Logo:</strong> Klik kotak logo untuk upload gambar (auto-resize, tidak harus bulat)</li>
            <li>✅ <strong>Tambah/Hapus Logo:</strong> Gunakan tombol "+ Tambah Logo" atau "×" untuk mengelola logo</li>
            <li>✅ <strong>Overlay Gradient:</strong> Centang untuk tambah gradient warna dari atas ke bawah (transparan)</li>
            <li>✅ <strong>Refresh Data:</strong> Klik "Refresh Data" untuk update cuaca terbaru dari BMKG</li>
            <li>✅ <strong>Download:</strong> Klik "Download" untuk simpan gambar (1080x1348px)</li>
            <li>✅ Logo otomatis resize proporsional (tidak terdistorsi), bisa logo bulat atau kotak</li>
          </ul>
        </div>
      </div>

      {/* Hidden canvas for download */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div >
  );
};

export default WeatherForecast;