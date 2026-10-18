import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { moneyAxis } from '../lib/format';

/** Largeur réelle du conteneur, pour dessiner les graphiques au pixel près (le texte ne se déforme pas). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Barre aux coins supérieurs arrondis (4 px), base carrée posée sur l'axe. */
function barPath(x: number, y0: number, w: number, y1: number, roundTop: boolean): string {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return '';
  const r = roundTop ? Math.min(4, h, w / 2) : 0;
  if (y1 < y0) {
    // vers le haut
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  }
  // vers le bas (valeur négative)
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface ColumnChartProps {
  labels: string[];
  sublabels?: string[];
  series: Series[];
  marker?: { label: string; values: (number | null)[] };
  barColor?: (index: number) => string | undefined;
  highlight?: number;
  height?: number;
  tooltip: (index: number) => ReactNode;
  ariaLabel: string;
  onSelect?: (index: number) => void;
}

/** Colonnes (empilées si plusieurs séries), avec repère optionnel (budget, objectif…) et info-bulle. */
export function ColumnChart({ labels, sublabels, series, marker, barColor, highlight, height = 220, tooltip, ariaLabel, onSelect }: ColumnChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const m = { top: 14, right: 8, bottom: sublabels ? 38 : 24, left: 46 };
  const plotW = Math.max(0, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;

  const totals = labels.map((_, i) => series.reduce((a, s) => a + Math.max(0, s.values[i] ?? 0), 0));
  const negatives = labels.map((_, i) => series.reduce((a, s) => a + Math.min(0, s.values[i] ?? 0), 0));
  const markerVals = (marker?.values ?? []).filter((v): v is number => v !== null);
  const maxV = Math.max(0, ...totals, ...markerVals);
  const minV = Math.min(0, ...negatives, ...markerVals);
  const ticks = niceTicks(minV, maxV > minV ? maxV : minV + 100);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => m.top + plotH - ((v - lo) / (hi - lo)) * plotH;

  const slot = n > 0 ? plotW / n : 0;
  const barW = Math.max(4, Math.min(24, slot * 0.56));
  const longest = Math.max(1, ...labels.map((l) => l.length), ...(sublabels ?? []).map((l) => l.length));
  const labelEvery = Math.max(1, Math.ceil((longest * 6.6 + 8) / Math.max(slot, 1)));
  const cx = (i: number) => m.left + slot * i + slot / 2;

  const active = hover;

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <g className="grid">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis-line' : 'grid-line'} />
                <text x={m.left - 8} y={y(t) + 4} textAnchor="end" className="tick">
                  {moneyAxis(t)}
                </text>
              </g>
            ))}
          </g>
          {labels.map((label, i) => {
            const x = cx(i) - barW / 2;
            let accPos = 0;
            let accNeg = 0;
            const visible = series.filter((s) => (s.values[i] ?? 0) !== 0);
            const topKey = [...visible].reverse().find((s) => (s.values[i] ?? 0) > 0)?.key;
            const override = barColor?.(i);
            const dim = active !== null && active !== i;
            return (
              <g key={label + i} opacity={dim ? 0.45 : 1}>
                {visible.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  if (v > 0) {
                    const gap = si > 0 && accPos > 0 ? 2 : 0;
                    const y0 = y(accPos) - gap;
                    accPos += v;
                    const y1 = y(accPos);
                    if (y0 - y1 < 0.5) return null;
                    return <path key={s.key} d={barPath(x, y0, barW, y1, s.key === topKey)} fill={override ?? s.color} />;
                  }
                  const y0 = y(accNeg);
                  accNeg += v;
                  return <path key={s.key} d={barPath(x, y0, barW, y(accNeg), true)} fill={override ?? s.color} />;
                })}
                {marker && marker.values[i] !== null && marker.values[i] !== undefined && (
                  <line x1={x - 6} x2={x + barW + 6} y1={y(marker.values[i] as number)} y2={y(marker.values[i] as number)} className="marker-line" />
                )}
                {i % labelEvery === 0 && (
                  <text x={cx(i)} y={height - (sublabels ? 22 : 6)} textAnchor="middle" className={`xlabel ${highlight === i ? 'xlabel-strong' : ''}`}>
                    {label}
                  </text>
                )}
                {sublabels && i % labelEvery === 0 && (
                  <text x={cx(i)} y={height - 6} textAnchor="middle" className="xsublabel">
                    {sublabels[i]}
                  </text>
                )}
                <rect
                  x={m.left + slot * i}
                  y={m.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => {
                    setHover(hover === i ? null : i);
                    onSelect?.(i);
                  }}
                />
              </g>
            );
          })}
        </svg>
      )}
      {active !== null && width > 0 && (
        <div className="tooltip" style={{ left: Math.min(Math.max(cx(active), 90), width - 90), top: 0 }}>
          {tooltip(active)}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color?: string; kind?: 'swatch' | 'marker' }[] }) {
  return (
    <ul className="legend">
      {items.map((it) => (
        <li key={it.label}>
          {it.kind === 'marker' ? <span className="legend-marker" /> : <span className="legend-swatch" style={{ background: it.color }} />}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Anneau de répartition ; les segments sont séparés par un fin espace couleur du fond. */
export function Donut({ slices, size = 168, center, sub, active, onActive }: { slices: DonutSlice[]; size?: number; center: string; sub: string; active?: string | null; onActive?: (key: string | null) => void }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const R = size / 2;
  const r = R - 20;
  const visible = slices.filter((s) => s.value > 0);
  const pad = visible.length > 1 ? 0.025 : 0;
  let angle = -Math.PI / 2;
  const arcs = visible.map((s) => {
    const sweep = (s.value / total) * Math.PI * 2;
    const a0 = angle + pad / 2;
    const a1 = angle + sweep - pad / 2;
    angle += sweep;
    return { ...s, a0, a1 };
  });
  const pt = (rad: number, a: number) => `${R + rad * Math.cos(a)},${R + rad * Math.sin(a)}`;
  const arcPath = (a0: number, a1: number) => {
    if (a1 - a0 >= Math.PI * 2 - 0.001) {
      // anneau complet
      return `M${pt(R, -Math.PI / 2)}A${R},${R} 0 1 1 ${pt(R, Math.PI * 1.5 - 0.0001)}Z M${pt(r, -Math.PI / 2)}A${r},${r} 0 1 0 ${pt(r, Math.PI * 1.5 - 0.0001)}Z`;
    }
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${pt(R, a0)}A${R},${R} 0 ${large} 1 ${pt(R, a1)}L${pt(r, a1)}A${r},${r} 0 ${large} 0 ${pt(r, a0)}Z`;
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${center} ${sub}`} className="donut">
      {total === 0 ? (
        <circle cx={R} cy={R} r={R - 10} fill="none" className="donut-empty" strokeWidth={20} />
      ) : (
        arcs.map((a) => (
          <path
            key={a.key}
            d={arcPath(a.a0, a.a1)}
            fill={a.color}
            fillRule="evenodd"
            opacity={active && active !== a.key ? 0.35 : 1}
            onMouseEnter={() => onActive?.(a.key)}
            onMouseLeave={() => onActive?.(null)}
          >
            <title>{a.label}</title>
          </path>
        ))
      )}
      <text x={R} y={R + 2} textAnchor="middle" className="donut-center">
        {center}
      </text>
      <text x={R} y={R + 22} textAnchor="middle" className="donut-sub">
        {sub}
      </text>
    </svg>
  );
}
