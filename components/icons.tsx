import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  CircleOff,
  Download,
  FilterX,
  ListFilter,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
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
    id: "chevron-left",
    name: "Chevron left",
    lucide: "ChevronLeft",
    usedIn: "Theme table pager",
    Icon: ChevronLeft,
  },
  {
    id: "chevron-right",
    name: "Chevron right",
    lucide: "ChevronRight",
    usedIn: "Trade expand, theme table pager",
    Icon: ChevronRight,
  },
  {
    id: "chevrons-up",
    name: "Chevrons up",
    lucide: "ChevronsUp",
    usedIn: "Theme table hide filters",
    Icon: ChevronsUp,
  },
  {
    id: "circle-off",
    name: "Disable",
    lucide: "CircleOff",
    usedIn: "Theme table bulk disable",
    Icon: CircleOff,
  },
  {
    id: "download",
    name: "Download",
    lucide: "Download",
    usedIn: "Theme table export",
    Icon: Download,
  },
  {
    id: "filter-x",
    name: "Clear filters",
    lucide: "FilterX",
    usedIn: "Theme table clear filters",
    Icon: FilterX,
  },
  {
    id: "list-filter",
    name: "Filters",
    lucide: "ListFilter",
    usedIn: "Theme table show filters",
    Icon: ListFilter,
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
    usedIn: "TP/SL, trailing, theme table row actions",
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
    usedIn: "Theme table row actions",
    Icon: SquareArrowOutUpRight,
  },
  {
    id: "plus",
    name: "Plus",
    lucide: "Plus",
    usedIn: "Theme table new item",
    Icon: Plus,
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
    usedIn: "AppSelect pills, panel close, theme table clear selection",
    Icon: X,
  },
  {
    id: "trash",
    name: "Delete",
    lucide: "Trash2",
    usedIn: "Theme table row and bulk delete",
    Icon: Trash2,
  },
] as const satisfies readonly LucideIconEntry[];

export function IconCheck(props: LucideProps) {
  return <Check aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconChevronDown(props: LucideProps) {
  return <ChevronDown aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconChevronLeft(props: LucideProps) {
  return <ChevronLeft aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconChevronRight(props: LucideProps) {
  return <ChevronRight aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconChevronsUp(props: LucideProps) {
  return <ChevronsUp aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconDisable(props: LucideProps) {
  return <CircleOff aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconDownload(props: LucideProps) {
  return <Download aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconFilterClear(props: LucideProps) {
  return <FilterX aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconFilters(props: LucideProps) {
  return <ListFilter aria-hidden strokeWidth={STROKE} {...props} />;
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

export function IconPlus(props: LucideProps) {
  return <Plus aria-hidden strokeWidth={STROKE} {...props} />;
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
