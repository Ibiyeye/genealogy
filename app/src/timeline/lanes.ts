/**
 * Lane assignment for timeline lifespan bars: greedy interval scheduling —
 * each bar takes the lowest lane whose last occupant ends before it starts.
 * Pure and unit-testable.
 */

export interface LaneItem {
  id: string;
  start: number;
  end: number;
}

export interface LaneAssignment {
  lanes: Map<string, number>;
  laneCount: number;
}

const GAP = 8; // years of horizontal breathing room between bars in a lane

export function packLanes(items: LaneItem[]): LaneAssignment {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const item of sorted) {
    let lane = laneEnds.findIndex((end) => end + GAP <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    lanes.set(item.id, lane);
  }
  return { lanes, laneCount: laneEnds.length };
}

/** Background era bands drawn behind the bars; labels sit in the axis strip. */
export const ERA_BANDS: Array<{ label: string; from: number; to: number }> = [
  { label: "Antediluvian", from: -4100, to: -2350 },
  { label: "Patriarchs", from: -2350, to: -1700 },
  { label: "Egypt & Exodus", from: -1700, to: -1200 },
  { label: "Judges", from: -1200, to: -1050 },
  { label: "United Monarchy", from: -1050, to: -930 },
  { label: "Divided Kingdom", from: -930, to: -586 },
  { label: "Exile & Return", from: -586, to: -400 },
  { label: "Second Temple", from: -400, to: -6 },
  { label: "New Testament", from: -6, to: 150 },
];
