import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, Plus, RotateCcw, X } from 'lucide-react';
import {
  DEFAULT_OVERLAY, makeLogos, overlayBackground, readFileAsDataUrl, uid,
  type LogoItem, type OverlaySettings, type OverlayType, type TextFields,
} from '../../lib/customize';

// ---------------------------------------------------------------------------
// Section (collapsible)
// ---------------------------------------------------------------------------
export const Section = ({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) => (
  <details className="mt-4 pt-4 border-t border-gray-200 group" open={defaultOpen}>
    <summary className="text-sm font-bold text-gray-800 cursor-pointer select-none list-none flex items-center gap-1.5">
      <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
      {title}
    </summary>
    <div className="mt-3">{children}</div>
  </details>
);

// ---------------------------------------------------------------------------
// Logo manager: tambah, hapus, ganti, urutkan, ukuran
// ---------------------------------------------------------------------------
interface LogoManagerProps {
  logos: LogoItem[];
  onChange: (logos: LogoItem[]) => void;
  defaults: string[];
  max?: number;
  size?: number;
  onSizeChange?: (n: number) => void;
  sizeMin?: number;
  sizeMax?: number;
}

export const LogoManager = ({ logos, onChange, defaults, max = 10, size, onSizeChange, sizeMin = 24, sizeMax = 90 }: LogoManagerProps) => {
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const urls = await Promise.all(Array.from(files).map(readFileAsDataUrl));
    onChange([...logos, ...urls.map((src) => ({ id: uid(), src }))].slice(0, max));
  };

  const replace = async (id: string, file?: File) => {
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    onChange(logos.map((l) => (l.id === id ? { ...l, src } : l)));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= logos.length) return;
    const next = [...logos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  // ---- drag & drop (pointer events: mouse + sentuh) ----
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const itemIdAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-logo-id]') as HTMLElement | null;
    return el?.dataset.logoId ?? null;
  };

  const onHandleDown = (e: ReactPointerEvent, id: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragId(id);
    setOverId(id);
  };
  const onHandleMove = (e: ReactPointerEvent) => {
    if (!dragId) return;
    const id = itemIdAt(e.clientX, e.clientY);
    if (id) setOverId(id);
  };
  const onHandleUp = () => {
    if (dragId && overId && dragId !== overId) {
      const from = logos.findIndex((l) => l.id === dragId);
      const to = logos.findIndex((l) => l.id === overId);
      const next = [...logos];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      onChange(next);
    }
    setDragId(null);
    setOverId(null);
  };

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button
          onClick={() => addRef.current?.click()}
          disabled={logos.length >= max}
          className="text-xs px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-md flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Tambah Logo
        </button>
        <button onClick={() => onChange(makeLogos(defaults))} className="text-xs px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Logo Default
        </button>
        {logos.length > 0 && (
          <button onClick={() => onChange([])} className="text-xs px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md">
            Hapus Semua
          </button>
        )}
        <span className="text-xs text-gray-500">{logos.length}/{max} logo · seret ⠿ untuk mengurutkan, klik logo untuk mengganti</span>
        {onSizeChange && size != null && (
          <label className="flex items-center gap-2 text-xs text-gray-600 ml-auto">
            Ukuran logo
            <input type="range" min={sizeMin} max={sizeMax} value={size} onChange={(e) => onSizeChange(Number(e.target.value))} className="w-28 accent-blue-600" />
            <span className="w-10">{size}px</span>
          </label>
        )}
      </div>
      <input ref={addRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

      {logos.length === 0 ? (
        <p className="text-xs text-gray-500 italic">Tidak ada logo. Header akan tampil tanpa logo.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
          {logos.map((logo, i) => (
            <div
              key={logo.id}
              data-logo-id={logo.id}
              className={`relative rounded-lg transition-all ${dragId === logo.id ? 'opacity-40 scale-95' : ''} ${overId === logo.id && dragId && dragId !== logo.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
            >
              <div
                onPointerDown={(e) => onHandleDown(e, logo.id)}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                className="absolute top-1 left-1 z-10 p-0.5 rounded bg-white/90 border border-gray-200 text-gray-500 cursor-grab active:cursor-grabbing touch-none"
                title="Seret untuk mengubah urutan"
              >
                <GripVertical className="w-4 h-4" />
              </div>
              <div
                onClick={() => replaceRefs.current[logo.id]?.click()}
                title="Klik untuk mengganti"
                className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-2 flex items-center justify-center h-20 bg-gray-50 hover:bg-gray-100"
              >
                <img src={logo.src} alt={`Logo ${i + 1}`} className="max-w-full max-h-14 object-contain" />
              </div>
              <div className="flex items-center justify-between mt-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-30" title="Geser kiri">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-gray-500">#{i + 1}</span>
                <button onClick={() => move(i, 1)} disabled={i === logos.length - 1} className="p-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-30" title="Geser kanan">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => onChange(logos.filter((l) => l.id !== logo.id))}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                title="Hapus logo"
              >
                <X className="w-3 h-3" />
              </button>
              <input
                ref={(el) => { replaceRefs.current[logo.id] = el; }}
                type="file" accept="image/*" className="hidden"
                onChange={(e) => { replace(logo.id, e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Editor teks: isi, warna, ukuran font
// ---------------------------------------------------------------------------
export const TextFieldsEditor = ({ fields }: { fields: TextFields }) => {
  const groups: string[] = [];
  fields.defs.forEach((d) => { if (!groups.includes(d.group)) groups.push(d.group); });

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        <button onClick={fields.resetStyles} className="text-xs px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Reset warna & ukuran
        </button>
        <button onClick={fields.resetAll} className="text-xs px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Reset semua teks
        </button>
        <span className="text-xs text-gray-500 self-center">Ukuran dalam px pratinjau (hasil unduhan ±1,5×).</span>
      </div>
      <div className="space-y-2">
        {groups.map((g) => (
          <details key={g} className="bg-gray-50 rounded-lg border border-gray-200">
            <summary className="px-3 py-2 text-sm font-semibold text-gray-700 cursor-pointer">{g}</summary>
            <div className="px-3 pb-3 space-y-3">
              {fields.defs.filter((d) => d.group === g).map((d) => {
                const st = fields.state[d.key] ?? {};
                const isAuto = d.color === '' && !st.color;
                return (
                  <div key={d.key} className="border-t border-gray-200 pt-2 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-700">{d.label}</span>
                      <button onClick={() => fields.resetKey(d.key)} className="text-gray-400 hover:text-gray-700" title="Reset">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {d.text !== undefined && (
                      d.multiline ? (
                        <textarea
                          rows={2}
                          value={st.text ?? ''}
                          onChange={(e) => fields.update(d.key, { text: e.target.value })}
                          className="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <input
                          value={st.text ?? ''}
                          onChange={(e) => fields.update(d.key, { text: e.target.value })}
                          className="w-full mt-1 p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )
                    )}
                    {(d.color !== undefined || d.size !== undefined) && (
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {d.color !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-gray-500">Warna</span>
                            <input
                              type="color"
                              value={st.color || '#000000'}
                              onChange={(e) => fields.update(d.key, { color: e.target.value })}
                              className="w-8 h-7 rounded cursor-pointer border border-gray-200 p-0.5"
                            />
                            {d.color === '' && (
                              <button
                                onClick={() => fields.update(d.key, { color: '' })}
                                className={`text-[11px] px-2 py-0.5 rounded ${isAuto ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                title="Warna mengikuti data/kategori"
                              >
                                Auto
                              </button>
                            )}
                            {!isAuto && <span className="text-[11px] text-gray-500 font-mono">{st.color}</span>}
                          </div>
                        )}
                        {d.size !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-gray-500">Ukuran</span>
                            <input
                              type="range"
                              min={Math.max(4, Math.round(d.size * 0.4))}
                              max={Math.round(d.size * 2 + 4)}
                              step={0.5}
                              value={st.size ?? d.size}
                              onChange={(e) => fields.update(d.key, { size: Number(e.target.value) })}
                              className="w-24 accent-blue-600"
                            />
                            <input
                              type="number"
                              min={4}
                              max={200}
                              step={0.5}
                              value={st.size ?? d.size}
                              onChange={(e) => { const v = Number(e.target.value); if (v > 0) fields.update(d.key, { size: v }); }}
                              className="w-16 p-1 border border-gray-300 rounded text-xs"
                            />
                            <span className="text-[11px] text-gray-500">px</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Editor overlay: jenis, arah, warna, opacity
// ---------------------------------------------------------------------------
const DIRECTIONS: { angle: number; label: string }[] = [
  { angle: 315, label: '↖' }, { angle: 0, label: '↑' }, { angle: 45, label: '↗' },
  { angle: 270, label: '←' }, { angle: -1, label: '' }, { angle: 90, label: '→' },
  { angle: 225, label: '↙' }, { angle: 180, label: '↓' }, { angle: 135, label: '↘' },
];
const RADIAL_POS: { pos: string; label: string }[] = [
  { pos: 'top left', label: '↖' }, { pos: 'top', label: '↑' }, { pos: 'top right', label: '↗' },
  { pos: 'left', label: '←' }, { pos: 'center', label: '•' }, { pos: 'right', label: '→' },
  { pos: 'bottom left', label: '↙' }, { pos: 'bottom', label: '↓' }, { pos: 'bottom right', label: '↘' },
];
const PRESETS: { name: string; v: Partial<OverlaySettings> }[] = [
  { name: 'Gelap atas', v: { type: 'linear', angle: 180, color1: '#000000', opacity1: 60, color2: '#000000', opacity2: 0 } },
  { name: 'Gelap bawah', v: { type: 'linear', angle: 0, color1: '#000000', opacity1: 60, color2: '#000000', opacity2: 0 } },
  { name: 'Putih kiri', v: { type: 'linear', angle: 90, color1: '#ffffff', opacity1: 75, color2: '#ffffff', opacity2: 15 } },
  { name: 'Biru → transparan', v: { type: 'linear', angle: 180, color1: '#0b1f4d', opacity1: 70, color2: '#38bdf8', opacity2: 0 } },
  { name: 'Vignette', v: { type: 'radial', radialPos: 'center', color1: '#000000', opacity1: 0, color2: '#000000', opacity2: 60 } },
  { name: 'Tipis rata', v: { type: 'solid', color1: '#ffffff', opacity1: 20 } },
];

export const OverlayEditor = ({ value, onChange }: { value: OverlaySettings; onChange: (v: OverlaySettings) => void }) => {
  const set = (patch: Partial<OverlaySettings>) => onChange({ ...value, ...patch });
  const typeBtn = (t: OverlayType, label: string) => (
    <button
      onClick={() => set({ type: t })}
      className={`px-3 py-1 rounded-md text-xs font-semibold ${value.type === t ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={value.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="w-4 h-4" />
        <span className="text-sm font-medium text-gray-700">Aktifkan overlay</span>
      </label>

      {value.enabled && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => set({ ...p.v, enabled: true })} className="text-[11px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-200">
                {p.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-6 items-start">
            <div>
              <div className="text-xs text-gray-600 mb-1">Jenis</div>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {typeBtn('solid', 'Solid')}
                {typeBtn('linear', 'Gradien Linear')}
                {typeBtn('radial', 'Gradien Radial')}
              </div>
            </div>

            {value.type === 'linear' && (
              <div>
                <div className="text-xs text-gray-600 mb-1">Arah (warna 1 → warna 2)</div>
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-3 gap-1">
                    {DIRECTIONS.map((d, i) =>
                      d.angle < 0 ? <div key={i} /> : (
                        <button
                          key={i}
                          onClick={() => set({ angle: d.angle })}
                          className={`w-7 h-7 rounded text-sm ${value.angle === d.angle ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                        >
                          {d.label}
                        </button>
                      )
                    )}
                  </div>
                  <label className="text-xs text-gray-600 flex flex-col gap-1">
                    Sudut: {value.angle}°
                    <input type="range" min={0} max={359} value={value.angle} onChange={(e) => set({ angle: Number(e.target.value) })} className="w-28 accent-blue-600" />
                  </label>
                </div>
              </div>
            )}

            {value.type === 'radial' && (
              <div>
                <div className="text-xs text-gray-600 mb-1">Titik pusat (warna 1 di pusat)</div>
                <div className="grid grid-cols-3 gap-1">
                  {RADIAL_POS.map((d) => (
                    <button
                      key={d.pos}
                      onClick={() => set({ radialPos: d.pos })}
                      className={`w-7 h-7 rounded text-sm ${value.radialPos === d.pos ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {([1, 2] as const).filter((n) => n === 1 || value.type !== 'solid').map((n) => {
                const ck = `color${n}` as const;
                const ok = `opacity${n}` as const;
                return (
                  <div key={n} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-14">{value.type === 'solid' ? 'Warna' : `Warna ${n}`}</span>
                    <input type="color" value={value[ck]} onChange={(e) => set({ [ck]: e.target.value })} className="w-9 h-8 rounded cursor-pointer border border-gray-200 p-0.5" />
                    <input type="range" min={0} max={100} value={value[ok]} onChange={(e) => set({ [ok]: Number(e.target.value) })} className="w-24 accent-blue-600" />
                    <span className="text-xs text-gray-600 w-10">{value[ok]}%</span>
                  </div>
                );
              })}
            </div>

            <div>
              <div className="text-xs text-gray-600 mb-1">Contoh</div>
              <div
                className="w-24 h-16 rounded-md border border-gray-200"
                style={{
                  backgroundImage: `${value.type === 'solid' ? `linear-gradient(${overlayBackground(value)}, ${overlayBackground(value)})` : overlayBackground(value)}, repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%)`,
                  backgroundSize: 'auto, 12px 12px',
                }}
              />
            </div>
          </div>

          <button onClick={() => onChange({ ...DEFAULT_OVERLAY, enabled: true })} className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-md">
            Reset overlay
          </button>
        </>
      )}
    </div>
  );
};

/** Lapisan overlay untuk diletakkan di dalam kanvas pratinjau. */
export const OverlayLayer = ({ value, className = '' }: { value: OverlaySettings; className?: string }) =>
  value.enabled ? <div className={`absolute inset-0 pointer-events-none ${className}`} style={{ background: overlayBackground(value) }} /> : null;
