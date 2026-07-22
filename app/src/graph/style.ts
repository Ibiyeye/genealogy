/**
 * Cytoscape stylesheet: typed-edge styling is the whole point.
 * Lineage solid, spousal dashed-soft, concubinage dashed, telescoped dotted
 * with ellipsis, conflict edges orange with a ⚠ label on hover.
 */
import type { StylesheetJson } from "cytoscape";

export const CY_STYLE: StylesheetJson = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      width: "label",
      height: 28,
      padding: "8px",
      shape: "round-rectangle",
      "background-color": "#252935",
      "border-width": 1,
      "border-color": "#4a4f5e",
      color: "#e6e2d8",
      "font-size": 12,
      "font-family": '"Iowan Old Style", Palatino, Georgia, serif',
      "text-valign": "center",
      "text-halign": "center",
      "text-max-width": "140px",
      "text-wrap": "ellipsis",
    },
  },
  {
    selector: "node[gender = 'female']",
    style: { "border-color": "#8a5f74" },
  },
  {
    selector: "node[gender = 'male']",
    style: { "border-color": "#4d6a85" },
  },
  {
    selector: "node[?unnamed]",
    style: { "border-style": "dashed", "font-style": "italic" as never },
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
    selector: "node.frontier-badge",
    style: {},
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "curve-style": "bezier",
      "line-color": "#555b6e",
      "target-arrow-shape": "none",
      "font-size": 9,
      color: "#9a96a0",
      "text-background-color": "#14161c",
      "text-background-opacity": 0.85,
      "text-background-padding": "2px",
    },
  },
  {
    selector: 'edge[type = "parent_of"]',
    style: {
      "line-color": "#7a8296",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#7a8296",
      "arrow-scale": 0.8,
    },
  },
  {
    selector: 'edge[type = "ancestor_of"]',
    style: {
      "line-style": "dotted",
      "line-color": "#7a8296",
      "target-arrow-shape": "triangle-tee",
      "target-arrow-color": "#7a8296",
      "arrow-scale": 0.8,
      label: "⋯",
      "font-size": 14,
    },
  },
  {
    selector: 'edge[type = "spouse_of"]',
    style: { "line-color": "#8a5f74", "line-style": "solid", width: 2 },
  },
  {
    selector: 'edge[type = "concubine_of"]',
    style: { "line-color": "#8a5f74", "line-style": "dashed", width: 1.5 },
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
      "line-style": "solid",
      "target-arrow-shape": "vee",
      "target-arrow-color": "#7fb4d9",
      "arrow-scale": 1,
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
    style: { "line-color": "#556070", "line-style": "dotted", width: 1 },
  },
  {
    selector: 'edge[type = "sibling_of"]',
    style: { "line-color": "#495064", "line-style": "solid", width: 1 },
  },
  {
    selector: "edge[?telescoped]",
    style: { "line-style": "dotted" },
  },
  {
    selector: "edge.conflict",
    style: {
      "line-color": "#d98e4a",
      "target-arrow-color": "#d98e4a",
      label: "data(conflictLabel)",
      "font-size": 10,
      color: "#d98e4a",
    },
  },
  {
    selector: "edge.conflict.alt",
    style: { "line-style": "dashed" },
  },
  {
    selector: "node.badge",
    style: {
      shape: "ellipse",
      width: 22,
      height: 22,
      padding: "0px",
      "background-color": "#2c3242",
      "border-color": "#c9a86a",
      "border-width": 1,
      color: "#c9a86a",
      "font-size": 10,
      label: "data(label)",
    },
  },
];
