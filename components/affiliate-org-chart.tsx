"use client";

import { useEffect, useRef } from "react";
import {
  AFFILIATE_ORG_MIN_ZOOM,
  affiliateOrgAutoZoom,
  affiliateOrgChartNodeHtml,
  affiliateOrgUserZoomedOut,
  flattenAffiliateOrgChart,
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
};

type OrgChartState = {
  lastTransform: { x: number; y: number; k: number };
  svg: {
    transition: () => {
      duration: (ms: number) => {
        call: (behavior: unknown, value?: unknown) => void;
      };
    };
  };
  zoomBehavior: { scaleTo: unknown };
};

type OrgChartHandle = {
  container: (el: HTMLElement) => OrgChartHandle;
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

function fitChart(chart: OrgChartHandle, animate: boolean) {
  const currentScale = chartScale(chart);
  if (affiliateOrgUserZoomedOut(currentScale)) {
    chart.fit({ animate, scale: false });
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
    },
  });
}

function applyChartHeight(chart: OrgChartHandle, host: HTMLElement) {
  const height = Math.max(host.clientHeight, 240);
  chart.svgHeight(height);
  const svg = host.querySelector("svg");
  if (svg) {
    svg.setAttribute("height", String(height));
  }
}

function highlightPerson(chart: OrgChartHandle, id: string) {
  chart.clearHighlighting();
  chart.setUpToTheRootHighlighted(id);
  chart.setHighlighted(id);
  chart.render();
}

export function AffiliateOrgChart({
  nodes,
  onSelect,
  onReady,
}: {
  nodes: AffiliateTreeNode[];
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
      const rows = flattenAffiliateOrgChart(nodes);
      const next = new OrgChart() as unknown as OrgChartHandle;
      next
        .container(hostRef.current)
        .svgHeight(Math.max(hostRef.current.clientHeight, 240))
        .compact(true)
        .layout("top")
        .defaultFont("var(--font-geist), ui-sans-serif, system-ui, sans-serif")
        .duration(200)
        .nodeWidth(() => 176)
        .nodeHeight(() => 72)
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
        .initialExpandLevel(2)
        .nodeContent((node) => {
          const row = node.data as {
            id: string;
            label: string;
            level: number;
            paid: boolean;
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
          return `<div style="margin:auto;border:1px solid #2A313C;border-radius:8px;background:#161B22;color:#9AA3B2;font-size:10px;line-height:1;padding:3px 6px">${open ? "−" : "+"} ${count}</div>`;
        })
        .linkUpdate(function (node) {
          const onPath = Boolean(node.data._upToTheRootHighlighted);
          this.setAttribute("stroke", onPath ? "#A78BFA" : "#2A313C");
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
        .render()
        .fit({ animate: false, scale: false });
      chart = next;
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
          next.fit();
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
          next.clearHighlighting();
        },
        setLayout: (layout: AffiliateOrgLayout) => {
          next.layout(layout).render();
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
        api.resize();
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
  }, [nodes]);

  if (nodes.length === 0) {
    return null;
  }

  return <div ref={hostRef} className="affiliate-org-chart h-full w-full" />;
}
