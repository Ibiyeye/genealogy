import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, type ScaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { PersonId } from "@genealogy/schema";
import { useStore } from "../store.js";
import { formatYear } from "../year.js";
import { ERA_BANDS, packLanes } from "./lanes.js";

const LANE_HEIGHT = 15;
const BAR_HEIGHT = 10;
const HIT_HEIGHT = 15; // invisible, larger hit target per bar
const AXIS_HEIGHT = 36;
const DOMAIN: [number, number] = [-4150, 160];

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Bar {
  id: PersonId;
  label: string;
  start: number;
  end: number;
  precise: boolean;
  fallback: boolean;
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState({ width: 800, height: 240 });
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  // Suppress x/width transitions during pan/zoom; enable them for layer swaps.
  const [animateBars, setAnimateBars] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const defaultLayerId = dataset?.manifest.defaultChronologyLayer ?? "theographic";
  const activeLayer = layers[chronologyLayerId];
  const defaultLayer = layers[defaultLayerId];

  // Animate bar movement when the chronology layer changes.
  useEffect(() => {
    if (REDUCED_MOTION) return;
    setAnimateBars(true);
    const t = setTimeout(() => setAnimateBars(false), 500);
    return () => clearTimeout(t);
  }, [chronologyLayerId]);

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
      // Spans covering (almost) the whole domain carry no chronological
      // information — Theographic gives God and the Spirit all-of-history
      // ranges. Skip them here; they remain fully present in the graph.
      if (end - start > 0.9 * (DOMAIN[1] - DOMAIN[0])) continue;
      items.push({
        id: person.id,
        label: person.primaryName,
        start,
        end: Math.max(end, start + 4),
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
  const x = useMemo(() => transform.rescaleX(baseScale), [transform, baseScale]);

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
    zoomRef.current = z;
    select(svg).call(z);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, [baseScale]);

  const resetZoom = (): void => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    zoomRef.current.transform(select(svg), zoomIdentity);
  };

  // Scroll the selected bar into view vertically.
  useEffect(() => {
    if (!selectedId || !scrollRef.current) return;
    const bar = bars.find((b) => b.id === selectedId);
    if (!bar) return;
    const el = scrollRef.current;
    const barY = AXIS_HEIGHT + bar.lane * LANE_HEIGHT;
    if (barY < el.scrollTop || barY > el.scrollTop + el.clientHeight - 40) {
      el.scrollTo({
        top: Math.max(0, barY - el.clientHeight / 2),
        behavior: REDUCED_MOTION ? "auto" : "smooth",
      });
    }
  }, [selectedId, bars]);

  const [x0, x1] = [x.invert(0), x.invert(size.width)];
  const visible = bars.filter((b) => b.end >= x0 && b.start <= x1);
  const totalLanes = bars.reduce((max, b) => Math.max(max, b.lane + 1), 0);
  const contentHeight = AXIS_HEIGHT + totalLanes * LANE_HEIGHT + 8;
  const ticks = x.ticks(Math.max(4, Math.floor(size.width / 110)));
  const showLabels = x(100) - x(0) > 0.55;
  const zoomed = transform.k !== 1 || transform.x !== 0;

  const barTransition = animateBars
    ? { transition: "x 0.4s ease, width 0.4s ease" }
    : undefined;

  if (!dataset || !activeLayer) {
    return (
      <section className="timeline-area">
        <div className="section-bar">
          <span className="section-title">Timeline</span>
        </div>
        <div className="placeholder" style={{ flex: 1 }}>
          <p>Loading chronology…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="timeline-area" aria-label="Timeline">
      <div className="section-bar">
        <span className="section-title">Timeline</span>
        <span className="section-hint">
          <kbd>scroll</kbd> zoom · <kbd>drag</kbd> pan · <kbd>click</kbd> a bar to select ·
          solid = dated · outlined = approximate era
        </span>
        {zoomed && (
          <button className="section-action" onClick={resetZoom}>
            ⟲ reset view
          </button>
        )}
      </div>
      <div className="timeline-scroll" ref={scrollRef}>
        <svg
          ref={svgRef}
          width={size.width}
          height={Math.max(contentHeight, size.height)}
          className="timeline-svg"
          onMouseLeave={() => setTooltip(null)}
        >
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
                {bw > 76 && (
                  <text x={Math.max(bx + 6, 6)} y={12} className="era-label">
                    {era.label}
                  </text>
                )}
              </g>
            );
          })}

          {ticks.map((t) => (
            <g key={t} transform={`translate(${x(t)},0)`}>
              <line
                y1={AXIS_HEIGHT - 12}
                y2={Math.max(contentHeight, size.height)}
                className="tick-line"
              />
              <text y={AXIS_HEIGHT - 16} className="tick-label" textAnchor="middle">
                {formatYear(t)}
              </text>
            </g>
          ))}

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
                  style={barTransition}
                />
                {/* invisible larger hit target (44px-rule adapted to lanes) */}
                <rect
                  x={bx - 2}
                  y={by - (HIT_HEIGHT - BAR_HEIGHT) / 2}
                  width={bw + 4}
                  height={HIT_HEIGHT}
                  className="life-bar-hit"
                  onClick={() => selectPerson(bar.id)}
                  onDoubleClick={() => focusPerson(bar.id)}
                  onMouseEnter={(e) => {
                    const rect = scrollRef.current?.getBoundingClientRect();
                    setTooltip({
                      x: e.clientX - (rect?.left ?? 0),
                      y: by - (scrollRef.current?.scrollTop ?? 0),
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
            style={{ left: tooltip.x + 12, top: Math.max(4, tooltip.y - 38) }}
          >
            <strong>{tooltip.bar.label}</strong>
            <div>
              {tooltip.bar.precise
                ? `${formatYear(tooltip.bar.start)} – ${formatYear(tooltip.bar.end)}`
                : `active c. ${formatYear(tooltip.bar.start)} – ${formatYear(tooltip.bar.end)}`}
              {tooltip.bar.fallback && (
                <div className="tooltip-note">no {activeLayer.label} date — showing estimate</div>
              )}
              <div className="tooltip-hint">click to select · double-click to focus the graph</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
