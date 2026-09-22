"use client";

import { useEffect, useRef } from "react";
import {
  AFFILIATE_ORG_DEFAULT_EXPAND_LEVEL,
  AFFILIATE_ORG_MIN_ZOOM,
  affiliateOrgAutoZoom,
  affiliateOrgChartNodeHtml,
  affiliateOrgUserZoomedOut,
  flattenAffiliateOrgChart,
  type AffiliateOrgDensity,
  type AffiliateOrgExpandLevel,
  type AffiliateOrgLayout,
} from "@/lib/membership/affiliate";
import type { AffiliateTreeNode } from "@/lib/membership/affiliate-store";

export type AffiliateOrgChartApi = {
  expandAll: () => void;
  collapseAll: () => void;
  fit: () => void;
  refit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resize: () => void;
  findPerson: (id: string) => void;
  clearFind: () => void;
  setLayout: (layout: AffiliateOrgLayout) => void;
  setDensity: (density: AffiliateOrgDensity) => void;
  setExpandLevel: (level: AffiliateOrgExpandLevel) => void;
};

type OrgChartState = {
  lastTransform: { x: number; y: number; k: number };
  layout?: string;
  data?: {
    id?: string;
    level?: number;
    _expanded?: boolean;
    _highlighted?: boolean;
    _upToTheRootHighlighted?: boolean;
    _centered?: boolean;
    _centeredWithDescendants?: boolean;
  }[];
  allNodes?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    depth?: number;
    _expanded?: boolean;
    parent?: unknown;
    data: {
      level?: number;
      _expanded?: boolean;
      _highlighted?: boolean;
      _upToTheRootHighlighted?: boolean;
      _centered?: boolean;
      _centeredWithDescendants?: boolean;
    };
  }[];
  svg: {
    transition: () => {
      duration: (ms: number) => {
        call: (behavior: unknown, value?: unknown) => void;
      };
    };
    call: (behavior: unknown, ...args: unknown[]) => void;
  };
  centerG?: {
    attr: (name: string, value?: string) => unknown;
  };
  zoomBehavior: {
    scaleTo: unknown;
    translateBy: unknown;
    translateTo: unknown;
    scaleExtent: (extent: [number, number]) => unknown;
  };
};

type OrgChartHandle = {
  container: (el: HTMLElement) => OrgChartHandle;
  svgWidth: (value: number) => OrgChartHandle;
  svgHeight: (value: number) => OrgChartHandle;
  data: (rows: unknown[]) => OrgChartHandle;
  compact: (value: boolean) => OrgChartHandle;
  layout: (value: string) => OrgChartHandle;
  defaultFont: (value: string) => OrgChartHandle;
  duration: (value: number) => OrgChartHandle;
  nodeWidth: (value: (node: unknown) => number) => OrgChartHandle;
  nodeHeight: (value: (node: unknown) => number) => OrgChartHandle;
  childrenMargin: (value: (node: unknown) => number) => OrgChartHandle;
  siblingsMargin: (value: (node: unknown) => number) => OrgChartHandle;
  neighbourMargin: (value: () => number) => OrgChartHandle;
  compactMarginPair: (value: () => number) => OrgChartHandle;
  compactMarginBetween: (value: () => number) => OrgChartHandle;
  nodeButtonWidth: (value: () => number) => OrgChartHandle;
  nodeButtonHeight: (value: () => number) => OrgChartHandle;
  nodeButtonX: (value: () => number) => OrgChartHandle;
  nodeButtonY: (value: () => number) => OrgChartHandle;
  initialExpandLevel: (value: number) => OrgChartHandle;
  initialZoom: (value: number) => OrgChartHandle;
  rootMargin: (value: number) => OrgChartHandle;
  setActiveNodeCentered: (value: boolean) => OrgChartHandle;
  nodeContent: (
    value: (node: { data: Record<string, unknown> }) => string,
  ) => OrgChartHandle;
  buttonContent: (
    value: (input: {
      node: { children?: unknown; data: Record<string, unknown> };
    }) => string,
  ) => OrgChartHandle;
  linkUpdate: (
    value: (
      this: SVGElement,
      node: { data: Record<string, unknown> },
    ) => void,
  ) => OrgChartHandle;
  nodeUpdate: (value: (this: SVGGElement) => void) => OrgChartHandle;
  onNodeClick: (
    value: (node: { data: Record<string, unknown> }) => void,
  ) => OrgChartHandle;
  setCentered: (id: string) => OrgChartHandle;
  setHighlighted: (id: string) => OrgChartHandle;
  setUpToTheRootHighlighted: (id: string) => OrgChartHandle;
  clearHighlighting: () => OrgChartHandle;
  render: () => OrgChartHandle;
  fit: (input?: {
    animate?: boolean;
    scale?: boolean;
    onCompleted?: () => void;
  }) => OrgChartHandle;
  expandAll: () => OrgChartHandle;
  collapseAll: () => OrgChartHandle;
  zoomIn: () => void;
  zoomOut: () => void;
  clear: () => void;
  getChartState: () => OrgChartState;
};

function chartScale(chart: OrgChartHandle): number {
  const k = chart.getChartState().lastTransform.k;
  return typeof k === "number" && k > 0 ? k : AFFILIATE_ORG_MIN_ZOOM;
}

function scaleChartTo(chart: OrgChartHandle, scale: number, animate: boolean) {
  const state = chart.getChartState();
  state.svg
    .transition()
    .duration(animate ? 200 : 0)
    .call(state.zoomBehavior.scaleTo, scale);
}

const AFFILIATE_ORG_TOP_INSET = 36;
const AFFILIATE_ORG_READY_HEIGHT = 200;

function nudgeChart(chart: OrgChartHandle, x: number, y: number) {
  const state = chart.getChartState();
  state.svg.call(state.zoomBehavior.translateBy, x, y);
}

function pinRootToTop(chart: OrgChartHandle, inset: number) {
  const state = chart.getChartState();
  const root = (state.allNodes ?? []).find((node) => !node.parent);
  if (!root) {
    return;
  }
  const top = (root.y ?? 0) * state.lastTransform.k + state.lastTransform.y;
  const dy = inset - top;
  if (Math.abs(dy) > 0.5) {
    nudgeChart(chart, 0, dy);
  }
}

function placeOpeningView(chart: OrgChartHandle, host: HTMLElement) {
  if (host.clientHeight < AFFILIATE_ORG_READY_HEIGHT) {
    return false;
  }
  applyChartHeight(chart, host);
  const state = chart.getChartState();
  const root = (state.allNodes ?? []).find((node) => !node.parent);
  if (!root) {
    return false;
  }
  state.centerG?.attr("transform", "translate(0,0)");
  const height = Math.max(host.clientHeight, 240);
  state.svg.call(state.zoomBehavior.scaleTo, AFFILIATE_ORG_MIN_ZOOM);
  state.svg.call(state.zoomBehavior.translateTo, root.x ?? 0, root.y ?? 0);
  nudgeChart(chart, 0, AFFILIATE_ORG_TOP_INSET - height / 2);
  return true;
}

const AFFILIATE_ORG_NODE_WIDTH = 168;
const AFFILIATE_ORG_NODE_HEIGHT = 90;
const AFFILIATE_ORG_FIT_PAD = 28;

function visibleChartBounds(chart: OrgChartHandle) {
  const nodes = chart.getChartState().allNodes ?? [];
  if (nodes.length === 0) {
    return null;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const width = node.width ?? AFFILIATE_ORG_NODE_WIDTH;
    const height = node.height ?? AFFILIATE_ORG_NODE_HEIGHT;
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    minX = Math.min(minX, x - width / 2);
    maxX = Math.max(maxX, x + width / 2);
    minY = Math.min(minY, y - height / 2);
    maxY = Math.max(maxY, y + height / 2);
  }
  return {
    midX: (minX + maxX) / 2,
    midY: (minY + maxY) / 2,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function fitToView(chart: OrgChartHandle, host: HTMLElement, animate: boolean) {
  applyChartHeight(chart, host);
  const state = chart.getChartState();
  state.centerG?.attr("transform", "translate(0,0)");
  const bounds = visibleChartBounds(chart);
  if (!bounds) {
    chart.fit({ animate, scale: true });
    return;
  }
  const viewW = Math.max(host.clientWidth - AFFILIATE_ORG_FIT_PAD * 2, 1);
  const viewH = Math.max(host.clientHeight - AFFILIATE_ORG_FIT_PAD * 2, 1);
  const scale = Math.min(viewW / bounds.width, viewH / bounds.height);
  state.zoomBehavior.scaleExtent([0.05, 8]);
  state.svg.call(state.zoomBehavior.scaleTo, scale);
  state.svg.call(state.zoomBehavior.translateTo, bounds.midX, bounds.midY);
}

function fitChart(chart: OrgChartHandle, animate: boolean) {
  const currentScale = chartScale(chart);
  const pinTop = () => {
    if (
      chart.getChartState().layout === "top" &&
      !affiliateOrgUserZoomedOut(chartScale(chart))
    ) {
      pinRootToTop(chart, AFFILIATE_ORG_TOP_INSET);
    }
  };
  if (affiliateOrgUserZoomedOut(currentScale)) {
    chart.fit({ animate, scale: false, onCompleted: pinTop });
    return;
  }
  chart.fit({
    animate,
    scale: true,
    onCompleted: () => {
      const target = affiliateOrgAutoZoom({
        fitScale: chartScale(chart),
        currentScale,
      });
      if (Math.abs(target - chartScale(chart)) > 0.001) {
        scaleChartTo(chart, target, animate);
      }
      pinTop();
    },
  });
}

function expandToLevel(chart: OrgChartHandle, level: AffiliateOrgExpandLevel) {
  const state = chart.getChartState();
  for (const node of state.allNodes ?? []) {
    const depth =
      typeof node.depth === "number"
        ? node.depth
        : Number(node.data.level ?? 0);
    const open = depth < level;
    node._expanded = open;
    node.data._expanded = open;
  }
  for (const row of state.data ?? []) {
    const depth = Number(row.level ?? 0);
    row._expanded = depth < level;
  }
  chart.initialExpandLevel(level);
  chart.render();
}

function applyChartHeight(chart: OrgChartHandle, host: HTMLElement) {
  const height = Math.max(host.clientHeight, 240);
  const width = Math.max(host.clientWidth, 240);
  chart.svgHeight(height);
  chart.svgWidth(width);
  const svg = host.querySelector("svg");
  if (svg) {
    svg.setAttribute("height", String(height));
    svg.setAttribute("width", String(width));
  }
}

function clearHighlightFlags(chart: OrgChartHandle) {
  const state = chart.getChartState();
  for (const row of state.data ?? []) {
    row._highlighted = false;
    row._upToTheRootHighlighted = false;
    row._centered = false;
    row._centeredWithDescendants = false;
  }
  for (const node of state.allNodes ?? []) {
    node.data._highlighted = false;
    node.data._upToTheRootHighlighted = false;
    node.data._centered = false;
    node.data._centeredWithDescendants = false;
  }
}

function highlightPerson(chart: OrgChartHandle, id: string) {
  clearHighlightFlags(chart);
  chart.setUpToTheRootHighlighted(id);
  const state = chart.getChartState();
  const row = (state.data ?? []).find((item) => String(item.id) === id);
  if (row) {
    row._highlighted = true;
    row._centered = false;
  }
  chart.render();
}

export function AffiliateOrgChart({
  nodes,
  rootPlanName,
  onSelect,
  onReady,
}: {
  nodes: AffiliateTreeNode[];
  rootPlanName?: string | null;
  onSelect?: (id: string, label: string) => void;
  onReady?: (api: AffiliateOrgChartApi | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  const readyRef = useRef(onReady);
  selectRef.current = onSelect;
  readyRef.current = onReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || nodes.length === 0) {
      return;
    }
    let disposed = false;
    let chart: OrgChartHandle | null = null;
    let observer: ResizeObserver | null = null;

    void import("d3-org-chart").then(({ OrgChart }) => {
      if (disposed || !hostRef.current) {
        return;
      }
      const rows = flattenAffiliateOrgChart(nodes, {
        planName: rootPlanName,
      });
      const next = new OrgChart() as unknown as OrgChartHandle;
      next
        .container(hostRef.current)
        .svgHeight(Math.max(hostRef.current.clientHeight, 240))
        .compact(true)
        .layout("top")
        .defaultFont("var(--font-geist), ui-sans-serif, system-ui, sans-serif")
        .duration(200)
        .nodeWidth(() => AFFILIATE_ORG_NODE_WIDTH)
        .nodeHeight(() => AFFILIATE_ORG_NODE_HEIGHT)
        .childrenMargin(() => 50)
        .siblingsMargin(() => 16)
        .neighbourMargin(() => 20)
        .compactMarginPair(() => 30)
        .compactMarginBetween(() => 35)
        .nodeButtonWidth(() => 28)
        .nodeButtonHeight(() => 22)
        .nodeButtonX(() => -14)
        .nodeButtonY(() => -8)
        .initialZoom(AFFILIATE_ORG_MIN_ZOOM)
        .rootMargin(72)
        .setActiveNodeCentered(false)
        .initialExpandLevel(AFFILIATE_ORG_DEFAULT_EXPAND_LEVEL)
        .nodeContent((node) => {
          const row = node.data as {
            id: string;
            label: string;
            level: number;
            paid: boolean;
            planName: string | null;
            runRateUsd: number;
            childCount: number;
            parentId: string | null;
          };
          return affiliateOrgChartNodeHtml(row, null, {
            onPath: Boolean(node.data._upToTheRootHighlighted),
            selected: Boolean(node.data._highlighted),
          });
        })
        .buttonContent(({ node }) => {
          const open = Boolean(node.children);
          const count = Number(node.data._directSubordinatesPaging ?? 0);
          return `<div class="affiliate-org-expand">${open ? "−" : "+"} ${count}</div>`;
        })
        .linkUpdate(function (node) {
          const onPath = Boolean(node.data._upToTheRootHighlighted);
          this.setAttribute(
            "stroke",
            onPath ? "var(--color-accent)" : "var(--color-line)",
          );
          this.setAttribute("stroke-width", onPath ? "2.5" : "1.5");
          if (onPath) {
            this.parentNode?.appendChild(this);
          }
        })
        .nodeUpdate(function () {
          const rect = this.querySelector(".node-rect");
          if (rect instanceof SVGElement) {
            rect.setAttribute("stroke", "none");
            rect.setAttribute("fill", "none");
          }
        })
        .onNodeClick((node) => {
          const id = String(node.data.id ?? "");
          if (!id) {
            return;
          }
          highlightPerson(next, id);
          selectRef.current?.(id, String(node.data.label ?? "Member"));
        })
        .data(rows)
        .render();
      chart = next;
      next.getChartState().zoomBehavior.scaleExtent([0.05, 8]);
      let placed = placeOpeningView(next, hostRef.current);
      const api: AffiliateOrgChartApi = {
        expandAll: () => {
          next.expandAll();
          fitChart(next, true);
        },
        collapseAll: () => {
          next.collapseAll();
          fitChart(next, true);
        },
        fit: () => {
          if (!hostRef.current) {
            return;
          }
          fitToView(next, hostRef.current, true);
        },
        refit: () => {
          fitChart(next, true);
        },
        zoomIn: () => {
          next.zoomIn();
        },
        zoomOut: () => {
          next.zoomOut();
        },
        findPerson: (id: string) => {
          highlightPerson(next, id);
        },
        clearFind: () => {
          clearHighlightFlags(next);
          next.render();
        },
        setLayout: (layout: AffiliateOrgLayout) => {
          next.layout(layout).render();
          fitChart(next, true);
        },
        setDensity: (density: AffiliateOrgDensity) => {
          next.compact(density === "compact").render();
          fitChart(next, true);
        },
        setExpandLevel: (level: AffiliateOrgExpandLevel) => {
          expandToLevel(next, level);
          fitChart(next, true);
        },
        resize: () => {
          if (!hostRef.current) {
            return;
          }
          applyChartHeight(next, hostRef.current);
        },
      };
      readyRef.current?.(api);
      observer = new ResizeObserver(() => {
        if (!hostRef.current) {
          return;
        }
        api.resize();
        if (!placed) {
          placed = placeOpeningView(next, hostRef.current);
        }
      });
      observer.observe(hostRef.current);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      readyRef.current?.(null);
      chart?.clear();
      host.replaceChildren();
    };
  }, [nodes, rootPlanName]);

  if (nodes.length === 0) {
    return null;
  }

  return <div ref={hostRef} className="affiliate-org-chart h-full w-full" />;
}
