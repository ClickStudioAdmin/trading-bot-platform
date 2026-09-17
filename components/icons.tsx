import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Play,
  SquareArrowOutUpRight,
  Star,
  Trash2,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

export type { LucideIcon };

const STROKE = 1.75;

export type LucideIconEntry = {
  id: string;
  name: string;
  lucide: string;
  usedIn: string;
  Icon: LucideIcon;
};

/** Add a Lucide icon here before using it. Import from this file, never `lucide-react`. */
export const LUCIDE_ICONS = [
  {
    id: "check",
    name: "Check",
    lucide: "Check",
    usedIn: "Pending submit, checkboxes, starter pack, plan compare",
    Icon: Check,
  },
  {
    id: "chevron-down",
    name: "Chevron down",
    lucide: "ChevronDown",
    usedIn: "AppSelect, desk switcher, contract select",
    Icon: ChevronDown,
  },
  {
    id: "chevron-right",
    name: "Chevron right",
    lucide: "ChevronRight",
    usedIn: "Trade expand",
    Icon: ChevronRight,
  },
  {
    id: "loader-circle",
    name: "Loader",
    lucide: "LoaderCircle",
    usedIn: "Pending submit busy",
    Icon: LoaderCircle,
  },
  {
    id: "pencil",
    name: "Pencil",
    lucide: "Pencil",
    usedIn: "TP/SL, trailing, theme table actions",
    Icon: Pencil,
  },
  {
    id: "play",
    name: "Play",
    lucide: "Play",
    usedIn: "Create desk placeholder",
    Icon: Play,
  },
  {
    id: "open",
    name: "Open",
    lucide: "SquareArrowOutUpRight",
    usedIn: "Theme table actions",
    Icon: SquareArrowOutUpRight,
  },
  {
    id: "star",
    name: "Star",
    lucide: "Star",
    usedIn: "Copy catalogue",
    Icon: Star,
  },
  {
    id: "star-filled",
    name: "Star filled",
    lucide: "Star",
    usedIn: "Copy catalogue",
    Icon: Star,
  },
  {
    id: "x",
    name: "Close",
    lucide: "X",
    usedIn: "AppSelect pills, panel close",
    Icon: X,
  },
  {
    id: "trash",
    name: "Delete",
    lucide: "Trash2",
    usedIn: "Theme table actions",
    Icon: Trash2,
  },
] as const satisfies readonly LucideIconEntry[];

export function IconCheck(props: LucideProps) {
  return <Check aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconChevronDown(props: LucideProps) {
  return <ChevronDown aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconChevronRight(props: LucideProps) {
  return <ChevronRight aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconLoader(props: LucideProps) {
  return <LoaderCircle aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconPencil(props: LucideProps) {
  return <Pencil aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconPlay(props: LucideProps) {
  return <Play aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconOpen(props: LucideProps) {
  return <SquareArrowOutUpRight aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconTrash(props: LucideProps) {
  return <Trash2 aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconStar(props: LucideProps) {
  return <Star aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconStarFilled(props: LucideProps) {
  return <Star aria-hidden strokeWidth={STROKE} fill="currentColor" {...props} />;
}

export function IconClose(props: LucideProps) {
  return <X aria-hidden strokeWidth={STROKE} {...props} />;
}
