import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  Ban,
  Camera,
  ChartColumn,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  CircleDot,
  CircleOff,
  CircleX,
  Copy,
  Download,
  FileText,
  FilterX,
  FlaskConical,
  FolderPlus,
  Handshake,
  Inbox,
  Landmark,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  ListFilter,
  Maximize2,
  Minimize2,
  Minus,
  Monitor,
  MonitorX,
  LoaderCircle,
  Mail,
  MailOpen,
  Pencil,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Moon,
  Share2,
  SquareArrowOutUpRight,
  Sun,
  Star,
  Trash2,
  Triangle,
  TrendingUp,
  Undo2,
  Upload,
  User,
  UserCog,
  Users,
  Wallet,
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
    id: "arrow-left-right",
    name: "Cash and Carry",
    lucide: "ArrowLeftRight",
    usedIn: "Desk Type",
    Icon: ArrowLeftRight,
  },
  {
    id: "archive",
    name: "Archive",
    lucide: "Archive",
    usedIn: "Plan and affiliate row actions",
    Icon: Archive,
  },
  {
    id: "archive-restore",
    name: "Un-archive",
    lucide: "ArchiveRestore",
    usedIn: "Plan row actions",
    Icon: ArchiveRestore,
  },
  {
    id: "ban",
    name: "Reject",
    lucide: "Ban",
    usedIn: "Payout queue reject",
    Icon: Ban,
  },
  {
    id: "camera",
    name: "Camera",
    lucide: "Camera",
    usedIn: "Chart toolbar save snapshot",
    Icon: Camera,
  },
  {
    id: "chart-column",
    name: "DCA",
    lucide: "ChartColumn",
    usedIn: "Desk Type",
    Icon: ChartColumn,
  },
  {
    id: "check",
    name: "Check",
    lucide: "Check",
    usedIn: "Pending submit, checkboxes, starter pack, plan compare, chart copied",
    Icon: Check,
  },
  {
    id: "check-check",
    name: "Mark all read",
    lucide: "CheckCheck",
    usedIn: "Inbox bulk",
    Icon: CheckCheck,
  },
  {
    id: "circle-x",
    name: "Close position",
    lucide: "CircleX",
    usedIn: "Blotter close",
    Icon: CircleX,
  },
  {
    id: "circle-dot",
    name: "Market",
    lucide: "CircleDot",
    usedIn: "Blotter market close",
    Icon: CircleDot,
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
    usedIn: "Table pager",
    Icon: ChevronLeft,
  },
  {
    id: "chevron-right",
    name: "Chevron right",
    lucide: "ChevronRight",
    usedIn: "Trade expand, table pager",
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
    usedIn: "Table bulk disable",
    Icon: CircleOff,
  },
  {
    id: "copy",
    name: "Copy",
    lucide: "Copy",
    usedIn: "Clone plan, copy affiliate URL, chart snapshot",
    Icon: Copy,
  },
  {
    id: "file-text",
    name: "Paper",
    lucide: "FileText",
    usedIn: "Desk mark",
    Icon: FileText,
  },
  {
    id: "download",
    name: "Download",
    lucide: "Download",
    usedIn: "Table export and CSV download",
    Icon: Download,
  },
  {
    id: "filter-x",
    name: "Clear filters",
    lucide: "FilterX",
    usedIn: "Table clear filters",
    Icon: FilterX,
  },
  {
    id: "expand",
    name: "Expand",
    lucide: "Maximize2",
    usedIn: "Chart toolbar fill browser",
    Icon: Maximize2,
  },
  {
    id: "folder-plus",
    name: "Add to folder",
    lucide: "FolderPlus",
    usedIn: "Template bulk add to folder",
    Icon: FolderPlus,
  },
  {
    id: "landmark",
    name: "Bybit",
    lucide: "Landmark",
    usedIn: "Desk mark",
    Icon: Landmark,
  },
  {
    id: "list-filter",
    name: "Filters",
    lucide: "ListFilter",
    usedIn: "Theme table show filters",
    Icon: ListFilter,
  },
  {
    id: "collapse",
    name: "Collapse",
    lucide: "Minimize2",
    usedIn: "Chart toolbar exit browser fill",
    Icon: Minimize2,
  },
  {
    id: "minus",
    name: "Limit",
    lucide: "Minus",
    usedIn: "Blotter limit close",
    Icon: Minus,
  },
  {
    id: "monitor",
    name: "Monitor",
    lucide: "Monitor",
    usedIn: "Chart toolbar full screen",
    Icon: Monitor,
  },
  {
    id: "monitor-x",
    name: "Exit monitor",
    lucide: "MonitorX",
    usedIn: "Chart toolbar exit full screen",
    Icon: MonitorX,
  },
  {
    id: "loader-circle",
    name: "Loader",
    lucide: "LoaderCircle",
    usedIn: "Pending submit busy",
    Icon: LoaderCircle,
  },
  {
    id: "mail",
    name: "Mark unread",
    lucide: "Mail",
    usedIn: "Inbox",
    Icon: Mail,
  },
  {
    id: "mail-open",
    name: "Mark read",
    lucide: "MailOpen",
    usedIn: "Inbox",
    Icon: MailOpen,
  },
  {
    id: "pencil",
    name: "Pencil",
    lucide: "Pencil",
    usedIn: "Edit, rename, TP/SL, trailing",
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
    usedIn: "Open and view-details row actions",
    Icon: SquareArrowOutUpRight,
  },
  {
    id: "radio",
    name: "Signal",
    lucide: "Radio",
    usedIn: "Desk Type",
    Icon: Radio,
  },
  {
    id: "plus",
    name: "Plus",
    lucide: "Plus",
    usedIn: "New item, new member, new plan, add folder",
    Icon: Plus,
  },
  {
    id: "refresh",
    name: "Replace",
    lucide: "RefreshCw",
    usedIn: "Replace connection key",
    Icon: RefreshCw,
  },
  {
    id: "share",
    name: "Share",
    lucide: "Share2",
    usedIn: "Template share",
    Icon: Share2,
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
    usedIn: "AppSelect pills, panel close, cancel order, clear selection",
    Icon: X,
  },
  {
    id: "triangle",
    name: "Hyperliquid",
    lucide: "Triangle",
    usedIn: "Desk mark",
    Icon: Triangle,
  },
  {
    id: "trending-up",
    name: "Perps",
    lucide: "TrendingUp",
    usedIn: "Desk Type",
    Icon: TrendingUp,
  },
  {
    id: "trash",
    name: "Delete",
    lucide: "Trash2",
    usedIn: "Row and bulk delete or remove",
    Icon: Trash2,
  },
  {
    id: "undo",
    name: "Unwind",
    lucide: "Undo2",
    usedIn: "Paper carry unwind",
    Icon: Undo2,
  },
  {
    id: "upload",
    name: "Import",
    lucide: "Upload",
    usedIn: "Template import",
    Icon: Upload,
  },
  {
    id: "users",
    name: "Copy Trading",
    lucide: "Users",
    usedIn: "Header nav",
    Icon: Users,
  },
  {
    id: "flask-conical",
    name: "Backtesting Tool",
    lucide: "FlaskConical",
    usedIn: "Header nav",
    Icon: FlaskConical,
  },
  {
    id: "layers",
    name: "Plans",
    lucide: "Layers",
    usedIn: "Header nav",
    Icon: Layers,
  },
  {
    id: "handshake",
    name: "Affiliates",
    lucide: "Handshake",
    usedIn: "Header nav",
    Icon: Handshake,
  },
  {
    id: "layout-dashboard",
    name: "Overview",
    lucide: "LayoutDashboard",
    usedIn: "Account sidenav",
    Icon: LayoutDashboard,
  },
  {
    id: "user-cog",
    name: "Profile & Settings",
    lucide: "UserCog",
    usedIn: "Account sidenav",
    Icon: UserCog,
  },
  {
    id: "wallet",
    name: "Billing & Account",
    lucide: "Wallet",
    usedIn: "Account sidenav",
    Icon: Wallet,
  },
  {
    id: "layout-grid",
    name: "Manage Desks",
    lucide: "LayoutGrid",
    usedIn: "Account sidenav",
    Icon: LayoutGrid,
  },
  {
    id: "layout-template",
    name: "Bot Templates",
    lucide: "LayoutTemplate",
    usedIn: "Account sidenav",
    Icon: LayoutTemplate,
  },
  {
    id: "inbox",
    name: "Inbox",
    lucide: "Inbox",
    usedIn: "Header inbox",
    Icon: Inbox,
  },
  {
    id: "moon",
    name: "Dark",
    lucide: "Moon",
    usedIn: "Theme page scheme toggle",
    Icon: Moon,
  },
  {
    id: "sun",
    name: "Light",
    lucide: "Sun",
    usedIn: "Theme page scheme toggle",
    Icon: Sun,
  },
  {
    id: "user",
    name: "Account",
    lucide: "User",
    usedIn: "Header account menu",
    Icon: User,
  },
] as const satisfies readonly LucideIconEntry[];

export function IconArchive(props: LucideProps) {
  return <Archive aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconUnarchive(props: LucideProps) {
  return <ArchiveRestore aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconReject(props: LucideProps) {
  return <Ban aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconCheck(props: LucideProps) {
  return <Check aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconMarkAllRead(props: LucideProps) {
  return <CheckCheck aria-hidden strokeWidth={STROKE} {...props} />;
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

export function IconClosePosition(props: LucideProps) {
  return <CircleX aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconMarket(props: LucideProps) {
  return <CircleDot aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconLimit(props: LucideProps) {
  return <Minus aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconFolderPlus(props: LucideProps) {
  return <FolderPlus aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconCopy(props: LucideProps) {
  return <Copy aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconDownload(props: LucideProps) {
  return <Download aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconFilterClear(props: LucideProps) {
  return (
    <FilterX
      aria-hidden
      strokeWidth={STROKE}
      {...props}
      size={12}
      className="size-3 shrink-0"
    />
  );
}

export function IconFilters(props: LucideProps) {
  return <ListFilter aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconLoader(props: LucideProps) {
  return <LoaderCircle aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconMail(props: LucideProps) {
  return <Mail aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconMailOpen(props: LucideProps) {
  return <MailOpen aria-hidden strokeWidth={STROKE} {...props} />;
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

export function IconReplace(props: LucideProps) {
  return <RefreshCw aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconShare(props: LucideProps) {
  return <Share2 aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconUnwind(props: LucideProps) {
  return <Undo2 aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconImport(props: LucideProps) {
  return <Upload aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconPaper(props: LucideProps) {
  return <FileText aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconBybit(props: LucideProps) {
  return <Landmark aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconHyperliquid(props: LucideProps) {
  return <Triangle aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconDca(props: LucideProps) {
  return <ChartColumn aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconPerps(props: LucideProps) {
  return <TrendingUp aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconCarry(props: LucideProps) {
  return <ArrowLeftRight aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconSignal(props: LucideProps) {
  return <Radio aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconCamera(props: LucideProps) {
  return <Camera aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconExpand(props: LucideProps) {
  return <Maximize2 aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconCollapse(props: LucideProps) {
  return <Minimize2 aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconMonitor(props: LucideProps) {
  return <Monitor aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconExitMonitor(props: LucideProps) {
  return <MonitorX aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconCopyTrading(props: LucideProps) {
  return <Users aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconBacktest(props: LucideProps) {
  return <FlaskConical aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconPlans(props: LucideProps) {
  return <Layers aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconAffiliates(props: LucideProps) {
  return <Handshake aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconOverview(props: LucideProps) {
  return <LayoutDashboard aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconProfile(props: LucideProps) {
  return <UserCog aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconBilling(props: LucideProps) {
  return <Wallet aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconDesks(props: LucideProps) {
  return <LayoutGrid aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconTemplates(props: LucideProps) {
  return <LayoutTemplate aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconInbox(props: LucideProps) {
  return <Inbox aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconMoon(props: LucideProps) {
  return <Moon aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconSun(props: LucideProps) {
  return <Sun aria-hidden strokeWidth={STROKE} {...props} />;
}

export function IconUser(props: LucideProps) {
  return <User aria-hidden strokeWidth={STROKE} {...props} />;
}
