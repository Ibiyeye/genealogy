import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, type ScaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import type { PersonId } from "@genealogy/schema";
import { useStore } from "../store.js";
import { formatYear } from "../year.js";
import { ERA_BANDS, packLanes } from "./lanes.js";

const LANE_HEIGHT = 13;
const BAR_HEIGHT = 9;
const AXIS_HEIGHT = 34;
const DOMAIN: [number, number] = [-4150, 160];

interface Bar {
  id: PersonId;
  label: string;
  start: number;
  end: number;
  precise: boolean; // birth+death known vs floruit-only
  fallback: boolean; // span borrowed from default layer (missing in active)
  lane: number;
}

interface Tooltip {
  x: number;
  y: number;
  bar: Bar;
}

export function TimelineView(): React.ReactElement {
  const dataset = useStore((s) => s.dataset);
  const layers = useStore((s) => s.layers);
  const chronologyLayerId = useStore((s) => s.chronologyLayerId);
  const selectedId = useStore((s) => s.selectedId);
  const selectPerson = useStore((s) => s.select);
  const focusPerson = useStore((s) => s.focus);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 800, height: 280 });
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  // Observe container size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const activeLayer = layers[chronologyLayerId];
  const defaultLayer = layers[useStore((s) => s.dataset?.manifest.defaultChronologyLayer ?? "theographic")];

  const bars: Bar[] = useMemo(() => {
    if (!dataset || !activeLayer) return [];
    const items: Omit<Bar, "lane">[] = [];
    for (const person of dataset.persons.values()) {
      let span = activeLayer.spans[person.id];
      let fallback = false;
      if (!span && defaultLayer && activeLayer.id !== defaultLayer.id) {
        span = defaultLayer.spans[person.id];
        fallback = span !== undefined;
      }
      if (!span) continue;
      const start = span.birth ?? span.active?.[0];
      const end = span.death ?? span.active?.[1];
      if (start === undefined || end === undefined) continue;
      items.push({
        id: person.id,
        label: person.primaryName,
        start,
        end: Math.max(end, start + 4), // minimum visible width
        precise: span.birth !== undefined && span.death !== undefined,
        fallback,
      });
    }
    const packed = packLanes(items);
    return items.map((item) => ({ ...item, lane: packed.lanes.get(item.id) ?? 0 }));
  }, [dataset, activeLayer, defaultLayer]);

  const baseScale: ScaleLinear<number, number> = useMemo(
    () => scaleLinear().domain(DOMAIN).range([0, size.width]),
    [size.width],
  );
  const x = useMemo(
    () => transform.rescaleX(baseScale),
    [transform, baseScale],
  );

  // d3-zoom wiring (x-axis pan/zoom only).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 40])
      .translateExtent([
        [baseScale(DOMAIN[0]), 0],
        [baseScale(DOMAIN[1]), 0],
      ])
      .on("zoom", (event: { transform: ZoomTransform }) => setTransform(event.transform));
    select(svg).call(z);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, [baseScale]);

  // Scroll the selected bar into view vertically.
  useEffect(() => {
    if (!selectedId || !containerRef.current) return;
    const bar = bars.find((b) => b.id === selectedId);
    if (!bar) return;
    const el = containerRef.current;
    const barY = AXIS_HEIGHT + bar.lane * LANE_HEIGHT;
    if (barY < el.scrollTop || barY > el.scrollTop + el.clientHeight - 40) {
      el.scrollTo({ top: Math.max(0, barY - el.clientHeight / 2), behavior: "smooth" });
    }
  }, [selectedId, bars]);

  const [x0, x1] = [x.invert(0), x.invert(size.width)];
  const visible = bars.filter((b) => b.end >= x0 && b.start <= x1);
  const totalLanes = bars.reduce((max, b) => Math.max(max, b.lane + 1), 0);
  const contentHeight = AXIS_HEIGHT + totalLanes * LANE_HEIGHT + 8;

  const ticks = x.ticks(Math.max(4, Math.floor(size.width / 110)));
  const showLabels = (x(100) - x(0)) > 0.55; // label bars only when zoomed enough

  if (!dataset || !activeLayer) {
    return <div className="timeline-area placeholder"><p>Loading chronology…</p></div>;
  }

  return (
    <div className="timeline-area" ref={containerRef}>
      <svg
        ref={svgRef}
        width={size.width}
        height={Math.max(contentHeight, size.height)}
        className="timeline-svg"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* era bands */}
        {ERA_BANDS.map((era, i) => {
          const bx = x(era.from);
          const bw = x(era.to) - bx;
          if (bx + bw < 0 || bx > size.width) return null;
          return (
            <g key={era.label}>
              <rect
                x={bx}
                y={0}
                width={bw}
                height={Math.max(contentHeight, size.height)}
                fill={i % 2 === 0 ? "rgba(255,255,255,0.018)" : "transparent"}
              />
              {bw > 70 && (
                <text x={Math.max(bx + 6, 6)} y={12} className="era-label">
                  {era.label}
                </text>
              )}
            </g>
          );
        })}

        {/* axis ticks */}
        {ticks.map((t) => (
          <g key={t} transform={`translate(${x(t)},0)`}>
            <line y1={AXIS_HEIGHT - 12} y2={Math.max(contentHeight, size.height)} className="tick-line" />
            <text y={AXIS_HEIGHT - 16} className="tick-label" textAnchor="middle">
              {formatYear(t)}
            </text>
          </g>
        ))}

        {/* lifespan bars */}
        {visible.map((bar) => {
          const bx = x(bar.start);
          const bw = Math.max(2, x(bar.end) - bx);
          const by = AXIS_HEIGHT + bar.lane * LANE_HEIGHT;
          const isSelected = bar.id === selectedId;
          const cls = [
            "life-bar",
            bar.precise ? "precise" : "floruit",
            bar.fallback ? "fallback" : "",
            isSelected ? "selected" : "",
          ].join(" ");
          return (
            <g key={bar.id}>
              <rect
                x={bx}
                y={by}
                width={bw}
                height={BAR_HEIGHT}
                rx={2}
                className={cls}
                onClick={() => selectPerson(bar.id)}
                onDoubleClick={() => focusPerson(bar.id)}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - (rect?.left ?? 0),
                    y: by - (containerRef.current?.scrollTop ?? 0),
                    bar,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              {(showLabels && bw > bar.label.length * 5.5) || isSelected ? (
                <text
                  x={bx + 4}
                  y={by + BAR_HEIGHT - 2}
                  className={`bar-label${isSelected ? " selected" : ""}`}
                >
                  {bar.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="timeline-tooltip"
          style={{ left: tooltip.x + 12, top: Math.max(4, tooltip.y - 34) }}
        >
          <strong>{tooltip.bar.label}</strong>
          <div>
            {tooltip.bar.precise
              ? `${formatYear(tooltip.bar.start)} – ${formatYear(tooltip.bar.end)}`
              : `active c. ${formatYear(tooltip.bar.start)} – ${formatYear(tooltip.bar.end)}`}
            {tooltip.bar.fallback && (
              <div className="tooltip-note">
                no {activeLayer.label} date — showing estimate
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
