/**
 * Cytoscape stylesheet. The arrow system encodes relationship semantics:
 *   parent_of      solid line, filled triangle → child
 *   ancestor_of    dotted line, hollow triangle → descendant ("⋯" = skipped)
 *   spouse_of      rose line, no arrows (symmetric)
 *   concubine_of   rose dashed, no arrows
 *   adopted_by     green dashed, diamond → adopter
 *   succeeded_by   blue line, chevron → successor
 *   mentored_by    violet dashed, circle at mentee side
 *   contemporary_of gray dotted, no arrows
 *   conflict pair  orange, one solid + one dashed, ⚠ label
 * All elements share opacity transitions so hover-dimming animates smoothly.
 */
import type { StylesheetJson } from "cytoscape";

export const CY_STYLE: StylesheetJson = [
  {
    selector: "node, edge",
    style: {
      "transition-property": "opacity",
      "transition-duration": 180 as never,
      "transition-timing-function": "ease-out",
    },
  },
  {
    selector: "node",
    style: {
      label: "data(label)",
      width: "label",
      height: 30,
      padding: "9px",
      shape: "round-rectangle",
      "background-color": "#252935",
      "border-width": 1.5,
      "border-color": "#4a4f5e",
      color: "#e6e2d8",
      "font-size": 12,
      "font-family": '"Crimson Pro", "Iowan Old Style", Palatino, Georgia, serif',
      "text-valign": "center",
      "text-halign": "center",
      "text-max-width": "150px",
      "text-wrap": "ellipsis",
      "overlay-padding": 6,
      "overlay-color": "#c9a86a",
      "overlay-opacity": 0,
    },
  },
  { selector: "node[gender = 'female']", style: { "border-color": "#8a5f74" } },
  { selector: "node[gender = 'male']", style: { "border-color": "#4d6a85" } },
  {
    selector: "node[?unnamed]",
    style: { "border-style": "dashed", "font-style": "italic" as never },
  },
  {
    selector: "node:active",
    style: { "overlay-opacity": 0.12 },
  },
  {
    selector: "node.focus",
    style: {
      "background-color": "#3a3320",
      "border-color": "#c9a86a",
      "border-width": 2,
      "font-size": 13,
    },
  },
  {
    selector: "node.selected",
    style: { "border-color": "#c9a86a", "border-width": 2.5 },
  },
  {
    selector: ".dim",
    style: { opacity: 0.18 },
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "curve-style": "bezier",
      "control-point-step-size": 32,
      "line-color": "#555b6e",
      "target-arrow-shape": "none",
      "source-arrow-shape": "none",
      "arrow-scale": 1.15,
      "font-size": 9,
      color: "#9a96a0",
      "text-background-color": "#14161c",
      "text-background-opacity": 0.85,
      "text-background-padding": "2px",
    },
  },
  // Lineage edges route orthogonally (organogram style): straight down,
  // one clean turn, rounded corner.
  {
    selector: 'edge[type = "parent_of"]',
    style: {
      "curve-style": "taxi",
      "taxi-direction": "downward",
      "taxi-turn": "40%",
      "taxi-turn-min-distance": 12,
      "corner-radius": 10 as never,
      width: 2.5,
      "line-color": "#8a93a8",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#8a93a8",
      "target-arrow-fill": "filled",
    },
  },
  {
    selector: 'edge[type = "ancestor_of"]',
    style: {
      "curve-style": "taxi",
      "taxi-direction": "downward",
      "taxi-turn": "40%",
      "taxi-turn-min-distance": 12,
      "corner-radius": 10 as never,
      "line-style": "dashed",
      "line-dash-pattern": [2, 5] as never,
      width: 2.5,
      "line-color": "#8a93a8",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#8a93a8",
      "target-arrow-fill": "hollow",
    },
  },
  // Lateral (non-hierarchy) ties render slightly transparent so the
  // generational structure stays dominant; hover restores full strength.
  {
    selector: 'edge[type = "spouse_of"]',
    style: { "line-color": "#a06e88", width: 2.5, opacity: 0.65 },
  },
  {
    selector: 'edge[type = "concubine_of"]',
    style: { "line-color": "#a06e88", "line-style": "dashed", width: 2, opacity: 0.65 },
  },
  {
    selector: 'edge[type = "adopted_by"]',
    style: {
      "line-color": "#8fbf9f",
      "line-style": "dashed",
      "target-arrow-shape": "diamond",
      "target-arrow-color": "#8fbf9f",
    },
  },
  {
    selector: 'edge[type = "succeeded_by"]',
    style: {
      "line-color": "#7fb4d9",
      width: 2.5,
      "target-arrow-shape": "chevron",
      "target-arrow-color": "#7fb4d9",
      "arrow-scale": 1.25,
    },
  },
  {
    selector: 'edge[type = "mentored_by"]',
    style: {
      "line-color": "#b8a6d9",
      "line-style": "dashed",
      "source-arrow-shape": "circle",
      "source-arrow-color": "#b8a6d9",
      "arrow-scale": 0.6,
    },
  },
  {
    selector: 'edge[type = "contemporary_of"]',
    style: { "line-color": "#556070", "line-style": "dotted", width: 1.5, opacity: 0.6 },
  },
  {
    selector: 'edge[type = "sibling_of"]',
    style: { "line-color": "#495064", width: 1.5, opacity: 0.6 },
  },
  { selector: "edge[?telescoped]", style: { "line-style": "dotted" } },
  {
    selector: "edge.conflict",
    style: {
      "line-color": "#d98e4a",
      "target-arrow-color": "#d98e4a",
      label: "⚠",
      "font-size": 10,
      color: "#d98e4a",
      width: 2.5,
    },
  },
  { selector: "edge.conflict.alt", style: { "line-style": "dashed" } },
  {
    selector: "edge.hover",
    style: { width: 3.5, opacity: 1 },
  },
  {
    selector: "node.badge",
    style: {
      shape: "ellipse",
      width: 24,
      height: 24,
      padding: "0px",
      "background-color": "#2c3242",
      "border-color": "#c9a86a",
      "border-width": 1,
      color: "#c9a86a",
      "font-size": 10,
      label: "data(label)",
      "overlay-opacity": 0,
    },
  },
  {
    selector: "node.badge:active",
    style: { "overlay-opacity": 0.15 },
  },
  {
    selector: "edge.badge-link",
    style: { "line-color": "#3a4050", "line-style": "dotted", width: 1 },
  },
];

/** Legend entries, mirrored from the selectors above. */
export const EDGE_LEGEND: Array<{
  type: string;
  label: string;
  color: string;
  dash?: "dashed" | "dotted";
  arrow?: "triangle" | "hollow-triangle" | "diamond" | "chevron" | "circle";
  hint: string;
}> = [
  { type: "parent_of", label: "parent → child", color: "#7a8296", arrow: "triangle", hint: "Arrow points from parent to child" },
  { type: "ancestor_of", label: "ancestor ⋯ descendant", color: "#7a8296", dash: "dotted", arrow: "hollow-triangle", hint: "Generations skipped in the text or omitted here" },
  { type: "spouse_of", label: "marriage", color: "#a06e88", hint: "No arrow — mutual" },
  { type: "concubine_of", label: "concubinage", color: "#a06e88", dash: "dashed", hint: "No arrow — mutual" },
  { type: "adopted_by", label: "adoption", color: "#8fbf9f", dash: "dashed", arrow: "diamond", hint: "Diamond points to the adopter" },
  { type: "succeeded_by", label: "succession", color: "#7fb4d9", arrow: "chevron", hint: "Chevron points to the successor" },
  { type: "mentored_by", label: "mentorship", color: "#b8a6d9", dash: "dashed", arrow: "circle", hint: "Circle marks the student" },
  { type: "contemporary_of", label: "contemporaries", color: "#556070", dash: "dotted", hint: "Lived at the same time" },
  { type: "sibling_of", label: "siblings", color: "#495064", hint: "No arrow — mutual" },
];
