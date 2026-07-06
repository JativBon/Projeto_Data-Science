import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pageSource = readFileSync(join(root, "app", "page.tsx"), "utf8");
const graphSource = readFileSync(join(root, "src", "components", "RamexGraphViewer.tsx"), "utf8");

function forumPhase2GraphType(phase2) {
  return phase2?.metrics?.heuristic_used === "forward" ? "forward" : "polytree";
}

function validationBool(validation, ...keys) {
  for (const key of keys) {
    if (validation?.[key] !== undefined) return validation[key];
  }
  return undefined;
}

function forumPhase2GraphValidation(phase2, edges) {
  if (!phase2) return undefined;
  const metrics = phase2.metrics ?? {};
  const structure = phase2.structure;
  const validation = phase2.validation ?? structure?.validation;
  const nodes = metrics.nodes_after
    ?? structure?.nodes_selected
    ?? new Set(edges.flatMap((edge) => [edge.From, edge.To])).size;
  const edgeCount = metrics.edges_after ?? structure?.edges_selected ?? edges.length;
  const edgesEqualNodesMinusOne = metrics.edges_eq_nodes_minus_1
    ?? metrics.edges_equals_nodes_minus_one
    ?? validationBool(validation, "edges_eq_nodes_minus_1", "edges_equals_nodes_minus_one")
    ?? (edgeCount === Math.max(nodes - 1, 0));
  const isDag = metrics.is_dag ?? structure?.is_dag ?? validationBool(validation, "is_dag", "is_acyclic");
  const isPolytree = metrics.is_valid_polytree
    ?? metrics.is_polytree
    ?? structure?.is_polytree
    ?? validationBool(validation, "is_valid_polytree", "is_polytree");

  return {
    is_dag: isDag,
    is_polytree: forumPhase2GraphType(phase2) === "polytree" ? isPolytree : undefined,
    edges_equal_nodes_minus_one: edgesEqualNodesMinusOne,
    edges: edgeCount,
    nodes,
    expected_edges: Math.max(nodes - 1, 0),
  };
}

const phase2 = {
  selected_edges: [
    { From: "A", To: "B", Weight: 10 },
    { From: "B", To: "C", Weight: 8 },
    { From: "C", To: "D", Weight: 6 },
  ],
  metrics: {
    heuristic_used: "back_and_forward",
    nodes_after: 4,
    edges_after: 3,
    is_dag: true,
    is_polytree: true,
    edges_eq_nodes_minus_1: true,
  },
};
const filtered = { validation: { is_dag: false } };
const phase2Edges = phase2.selected_edges.map((edge) => ({
  From: edge.From,
  To: edge.To,
  Weight: edge.Weight,
}));
const mapped = forumPhase2GraphValidation(phase2, phase2Edges);

assert.equal(filtered.validation.is_dag, false, "fixture keeps Fase 1/filtered DAG as false");
assert.equal(mapped.is_dag, true, "Fase 2 DAG must come from Fase 2 metrics");
assert.equal(mapped.is_polytree, true, "Fase 2 Poly-tree must come from Fase 2 metrics");
assert.equal(mapped.edges_equal_nodes_minus_one, true, "Fase 2 edge invariant must use Fase 2 naming");
assert.equal(mapped.edges, 3);
assert.equal(mapped.expected_edges, 3);
assert.equal(forumPhase2GraphType(phase2), "polytree");
assert.equal(forumPhase2GraphType({ metrics: { heuristic_used: "forward" } }), "forward");

assert.match(pageSource, /graphEdges=\{forumPhase2Edges\}/, "Upload Fase 2 card must render Fase 2 edges");
assert.match(pageSource, /graphType=\{resolvedForumPhase2GraphType\}/, "Upload Fase 2 card must use a Fase 2 graph type");
assert.match(pageSource, /graphValidation=\{forumPhase2Validation\}/, "Upload Fase 2 card must use Fase 2 validation");
assert.doesNotMatch(
  pageSource.slice(pageSource.indexOf('title="RAMEX-Forum temporal — Fase 2"'), pageSource.indexOf("<GraphRelationsTable title=\"Influência selecionada\"")),
  /graphValidation=\{normalizedResult\?\.filtered\.validation\}/,
  "Fase 2 card must not use filtered validation",
);

assert.match(graphSource, /markerEnd=\{`url\(#\$\{isFromRoot \? rootArrowMarkerId : arrowMarkerId\}\)`\}/, "directed edges keep markerEnd");
assert.match(graphSource, /const ARROW_MARKER = \{[\s\S]*size: 20,[\s\S]*refX: 17,[\s\S]*tipX: 19,/, "arrow marker geometry is declared once");
assert.match(graphSource, /<marker\s+id=\{arrowMarkerId\}[\s\S]*markerWidth=\{ARROW_MARKER\.size\}[\s\S]*markerHeight=\{ARROW_MARKER\.size\}[\s\S]*refX=\{ARROW_MARKER\.refX\}[\s\S]*refY=\{ARROW_MARKER\.refY\}[\s\S]*orient="auto"[\s\S]*markerUnits="userSpaceOnUse"/, "default arrow marker is fixed-size and auto-oriented");
assert.match(graphSource, /<marker\s+id=\{rootArrowMarkerId\}[\s\S]*markerWidth=\{ARROW_MARKER\.size\}[\s\S]*markerHeight=\{ARROW_MARKER\.size\}[\s\S]*refX=\{ARROW_MARKER\.refX\}[\s\S]*refY=\{ARROW_MARKER\.refY\}[\s\S]*orient="auto"[\s\S]*markerUnits="userSpaceOnUse"/, "root arrow marker is fixed-size and auto-oriented");
assert.match(graphSource, /function arrowEndpointOffset|export function arrowEndpointOffset/, "arrow endpoint offset is explicit");
assert.match(graphSource, /arrowEndpointOffset\(strokeW\)/, "edge endpoint uses a positive arrow offset");
assert.match(graphSource, /fill="context-stroke"/, "arrow marker inherits the edge stroke color");
assert.match(graphSource, /stroke="context-stroke"/, "arrow marker stroke inherits the edge stroke color");
assert.match(graphSource, /opacity="1"/, "arrow marker is fully opaque");

const arrowMarker = { size: 20, refX: 17, tipX: 19 };

function arrowEndpointOffset(strokeWidth, marker = arrowMarker) {
  const safeStrokeWidth = Number.isFinite(strokeWidth) ? Math.max(0, strokeWidth) : 0;
  const markerForwardOverhang = Math.max(0, marker.tipX - marker.refX);
  const markerBodyClearance = marker.size * 0.45;
  const strokeClearance = safeStrokeWidth / 2;
  return markerForwardOverhang + markerBodyClearance + strokeClearance;
}

function ellipseBoundaryPoint(from, to, dims, extra = 0) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const scale = 1 / Math.sqrt((ux * ux) / (dims.rx * dims.rx) + (uy * uy) / (dims.ry * dims.ry));
  return {
    x: from.x + ux * (scale + extra),
    y: from.y + uy * (scale + extra),
  };
}

function ellipseValue(point, center, dims) {
  const nx = (point.x - center.x) / dims.rx;
  const ny = (point.y - center.y) / dims.ry;
  return nx * nx + ny * ny;
}

const nodeDimsCases = [
  { rx: 8, ry: 8 },
  { rx: 14, ry: 12 },
  { rx: 38, ry: 26 },
  { rx: 58, ry: 36 },
  { rx: 115, ry: 31 },
];
const angles = [0, 15, 30, 45, 90, 135, 180, 225, 270, 315];
const distances = [60, 120, 260, 520];
const strokeWidths = [0.8, 2, 5, 9, 14];

for (const dims of nodeDimsCases) {
  for (const angle of angles) {
    for (const distance of distances) {
      for (const strokeWidth of strokeWidths) {
        const radians = (angle / 180) * Math.PI;
        const target = { x: 0, y: 0 };
        const source = { x: -Math.cos(radians) * distance, y: -Math.sin(radians) * distance };
        const padding = arrowEndpointOffset(strokeWidth);
        const endpoint = ellipseBoundaryPoint(target, source, dims, padding);
        const dist = Math.hypot(source.x - target.x, source.y - target.y) || 1;
        const ux = (source.x - target.x) / dist;
        const uy = (source.y - target.y) / dist;
        const markerForwardOverhang = Math.max(0, arrowMarker.tipX - arrowMarker.refX);
        const markerTip = {
          x: endpoint.x - ux * markerForwardOverhang,
          y: endpoint.y - uy * markerForwardOverhang,
        };

        assert.ok(Math.hypot(endpoint.x - target.x, endpoint.y - target.y) > 0, "endpoint must not collapse to target center");
        assert.ok(padding > markerForwardOverhang, "endpoint padding must be larger than marker forward overhang");
        assert.ok(ellipseValue(endpoint, target, dims) > 1, `line endpoint must be outside target ellipse for ${JSON.stringify({ dims, angle, distance, strokeWidth })}`);
        assert.ok(ellipseValue(markerTip, target, dims) > 1, `marker tip must remain outside target ellipse for ${JSON.stringify({ dims, angle, distance, strokeWidth })}`);
      }
    }
  }
}

console.log("Upload Fase 2 regression checks passed.");
