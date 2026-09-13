import type { AffiliateTreeNode } from "@/lib/membership/affiliate-store";

export function AffiliateOrgChart({
  nodes,
  rowHref,
}: {
  nodes: AffiliateTreeNode[];
  rowHref: (userId: string) => string;
}) {
  if (nodes.length === 0) {
    return null;
  }
  return (
    <ul className="space-y-2 border-l border-line pl-3 text-sm">
      {nodes.map((node) => (
        <li key={node.userId}>
          <a
            href={rowHref(node.userId)}
            className="text-accent hover:underline"
          >
            {node.label}
          </a>
          <span className="text-ink-muted">
            {" "}
            · L{node.level}
            {node.paid ? " · paid" : " · signup"}
          </span>
          {node.children.length > 0 ? (
            <div className="mt-2">
              <AffiliateOrgChart nodes={node.children} rowHref={rowHref} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
