import { useCallback, useMemo, useState, type CSSProperties } from 'react';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------
export interface LogoItem {
  id: string;
  src: string;
}

export const makeLogos = (srcs: string[]): LogoItem[] => srcs.map((src) => ({ id: uid(), src }));

// ---------------------------------------------------------------------------
// Teks: isi, warna, ukuran font
// ---------------------------------------------------------------------------
export interface TextDef {
  key: string;
  label: string;
  group: string;
  /** Isi teks default. undefined = isi tidak bisa diedit (mis. data API). */
  text?: string;
  multiline?: boolean;
  /** Warna default. '' = otomatis (warna dinamis dari data). undefined = warna tak bisa diubah. */
  color?: string;
  /** Ukuran font default dalam px (ukuran pratinjau). undefined = ukuran tak bisa diubah. */
  size?: number;
}

export interface TextState {
  text?: string;
  color?: string;
  size?: number;
}

const initialState = (defs: TextDef[]) =>
  Object.fromEntries(defs.map((d) => [d.key, { text: d.text, color: d.color, size: d.size }])) as Record<string, TextState>;

export function useTextFields(defs: TextDef[]) {
  const [state, setState] = useState<Record<string, TextState>>(() => initialState(defs));
  const defMap = useMemo(() => Object.fromEntries(defs.map((d) => [d.key, d])), [defs]);

  /** Isi teks */
  const t = useCallback((key: string) => state[key]?.text ?? defMap[key]?.text ?? '', [state, defMap]);

  /**
   * Gaya inline (color + fontSize).
   * factor: pengali ukuran untuk elemen yang ukurannya adaptif.
   * auto: warna yang dipakai bila pengguna memilih "Auto".
   */
  const s = useCallback(
    (key: string, opts?: { factor?: number; auto?: string }): CSSProperties => {
      const st = state[key];
      const out: CSSProperties = {};
      if (st?.size != null) out.fontSize = `${+(st.size * (opts?.factor ?? 1)).toFixed(2)}px`;
      const c = st?.color || opts?.auto;
      if (c) out.color = c;
      return out;
    },
    [state]
  );

  const update = useCallback((key: string, patch: TextState) => {
    setState((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
  }, []);

  const resetKey = useCallback(
    (key: string) => {
      const d = defMap[key];
      if (d) setState((p) => ({ ...p, [key]: { text: d.text, color: d.color, size: d.size } }));
    },
    [defMap]
  );

  const resetStyles = useCallback(() => {
    setState((p) =>
      Object.fromEntries(defs.map((d) => [d.key, { text: p[d.key]?.text ?? d.text, color: d.color, size: d.size }]))
    );
  }, [defs]);

  const resetAll = useCallback(() => setState(initialState(defs)), [defs]);

  return { defs, state, t, s, update, resetKey, resetStyles, resetAll };
}

export type TextFields = ReturnType<typeof useTextFields>;

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------
export type OverlayType = 'solid' | 'linear' | 'radial';

export interface OverlaySettings {
  enabled: boolean;
  type: OverlayType;
  /** derajat untuk linear: 180 = atas → bawah */
  angle: number;
  /** posisi pusat untuk radial, mis. 'center', 'top', 'bottom left' */
  radialPos: string;
  color1: string;
  opacity1: number; // 0-100
  color2: string;
  opacity2: number; // 0-100
}

export const DEFAULT_OVERLAY: OverlaySettings = {
  enabled: false,
  type: 'linear',
  angle: 180,
  radialPos: 'center',
  color1: '#000000',
  opacity1: 50,
  color2: '#000000',
  opacity2: 0,
};

export const hexToRgba = (hex: string, opacityPct: number) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacityPct)) / 100})`;
};

export const overlayBackground = (o: OverlaySettings) => {
  const c1 = hexToRgba(o.color1, o.opacity1);
  const c2 = hexToRgba(o.color2, o.opacity2);
  if (o.type === 'solid') return c1;
  if (o.type === 'radial') return `radial-gradient(circle at ${o.radialPos}, ${c1}, ${c2})`;
  return `linear-gradient(${o.angle}deg, ${c1}, ${c2})`;
};
