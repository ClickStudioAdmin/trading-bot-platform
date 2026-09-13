"use client";

import { useEffect, useRef } from "react";
import {
  AFFILIATE_ORG_ROOT_ID,
  affiliateOrgChartNodeHtml,
  flattenAffiliateOrgChart,
} from "@/lib/membership/affiliate";
import type { AffiliateTreeNode } from "@/lib/membership/affiliate-store";

export type AffiliateOrgChartApi = {
  expandAll: () => void;
  collapseAll: () => void;
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resize: () => void;
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
  nodeContent: (
    value: (node: { data: Record<string, unknown> }) => string,
  ) => OrgChartHandle;
  buttonContent: (
    value: (input: {
      node: { children?: unknown; data: Record<string, unknown> };
    }) => string,
  ) => OrgChartHandle;
  linkUpdate: (value: (this: SVGElement) => void) => OrgChartHandle;
  nodeUpdate: (value: (this: SVGGElement) => void) => OrgChartHandle;
  onNodeClick: (
    value: (node: { data: Record<string, unknown> }) => void,
  ) => OrgChartHandle;
  render: () => OrgChartHandle;
  fit: (input?: { animate?: boolean }) => OrgChartHandle;
  expandAll: () => OrgChartHandle;
  collapseAll: () => OrgChartHandle;
  zoomIn: () => void;
  zoomOut: () => void;
  clear: () => void;
};

function applyChartHeight(chart: OrgChartHandle, host: HTMLElement) {
  const height = Math.max(host.clientHeight, 240);
  chart.svgHeight(height);
  const svg = host.querySelector("svg");
  if (svg) {
    svg.setAttribute("height", String(height));
  }
}

export function AffiliateOrgChart({
  nodes,
  rowHref,
  onReady,
}: {
  nodes: AffiliateTreeNode[];
  rowHref: (userId: string) => string;
  onReady?: (api: AffiliateOrgChartApi | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const hrefRef = useRef(rowHref);
  const readyRef = useRef(onReady);
  hrefRef.current = rowHref;
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
          const href =
            row.id === AFFILIATE_ORG_ROOT_ID ? null : hrefRef.current(row.id);
          return affiliateOrgChartNodeHtml(row, href);
        })
        .buttonContent(({ node }) => {
          const open = Boolean(node.children);
          const count = Number(node.data._directSubordinatesPaging ?? 0);
          return `<div style="margin:auto;border:1px solid #2A313C;border-radius:8px;background:#161B22;color:#9AA3B2;font-size:10px;line-height:1;padding:3px 6px">${open ? "−" : "+"} ${count}</div>`;
        })
        .linkUpdate(function () {
          this.setAttribute("stroke", "#2A313C");
          this.setAttribute("stroke-width", "1.5");
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
          if (!id || id === AFFILIATE_ORG_ROOT_ID) {
            return;
          }
          window.location.assign(hrefRef.current(id));
        })
        .data(rows)
        .render()
        .fit({ animate: false });
      chart = next;
      const api: AffiliateOrgChartApi = {
        expandAll: () => {
          next.expandAll().fit();
        },
        collapseAll: () => {
          next.collapseAll().fit();
        },
        fit: () => {
          next.fit();
        },
        zoomIn: () => {
          next.zoomIn();
        },
        zoomOut: () => {
          next.zoomOut();
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
