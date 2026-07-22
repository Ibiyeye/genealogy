import { useState } from "react";
import { useStore } from "../store.js";
import { EDGE_LEGEND } from "./style.js";

/** Collapsible legend explaining the edge/arrow system, filtered to the
 *  relationship types currently visible. */
export function GraphLegend(): React.ReactElement {
  const visibleClaimTypes = useStore((s) => s.visibleClaimTypes);
  const [open, setOpen] = useState(true);

  const entries = EDGE_LEGEND.filter((e) => visibleClaimTypes.has(e.type as never));

  return (
    <div className={`graph-legend${open ? "" : " closed"}`}>
      <button
        className="legend-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d={open ? "M3 10l5-5 5 5" : "M3 6l5 5 5-5"}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Reading the lines
      </button>
      {open && (
        <ul className="legend-list">
          {entries.map((e) => (
            <li key={e.type} title={e.hint}>
              <svg width="34" height="10" viewBox="0 0 34 10" aria-hidden="true">
                <line
                  x1="1"
                  y1="5"
                  x2={e.arrow ? 26 : 33}
                  y2="5"
                  stroke={e.color}
                  strokeWidth="2"
                  strokeDasharray={e.dash === "dashed" ? "5 3" : e.dash === "dotted" ? "2 3" : undefined}
                />
                {e.arrow === "triangle" && <path d="M26 1l7 4-7 4z" fill={e.color} />}
                {e.arrow === "hollow-triangle" && (
                  <path d="M26 1.5l6.5 3.5-6.5 3.5z" fill="none" stroke={e.color} strokeWidth="1.4" />
                )}
                {e.arrow === "diamond" && <path d="M26 5l4-3.6 4 3.6-4 3.6z" fill={e.color} />}
                {e.arrow === "chevron" && (
                  <path d="M26 1l6 4-6 4" fill="none" stroke={e.color} strokeWidth="2" strokeLinecap="round" />
                )}
                {e.arrow === "circle" && <circle cx="4" cy="5" r="3" fill={e.color} />}
              </svg>
              <span>{e.label}</span>
            </li>
          ))}
          <li className="legend-conflict" title="Two sources make incompatible claims — both are shown">
            <svg width="34" height="10" viewBox="0 0 34 10" aria-hidden="true">
              <line x1="1" y1="3" x2="33" y2="3" stroke="#d98e4a" strokeWidth="2" />
              <line x1="1" y1="8" x2="33" y2="8" stroke="#d98e4a" strokeWidth="2" strokeDasharray="5 3" />
            </svg>
            <span>disputed — sources differ</span>
          </li>
        </ul>
      )}
    </div>
  );
}
