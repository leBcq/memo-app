import { parseStoredColor, hexToRgba } from "@/lib/menuColorUtils";

export type HeadingLevel = "h1" | "h2" | "h3" | null;

// ─── Custom Card (generic key-value property card) ────────────────────────────

export type CustomCardPropertyType = "text" | "textarea";

export interface CustomCardProperty {
  id: string;
  label: string;
  value: string;
  type: CustomCardPropertyType;
}

export interface CustomCardData {
  title: string;
  properties: CustomCardProperty[];
}

export const DEFAULT_CUSTOM_CARD: CustomCardData = { title: "", properties: [] };

export function normalizeCustomCardProperty(raw: unknown): CustomCardProperty {
  if (!raw || typeof raw !== "object") {
    return { id: String(Date.now()), label: "", value: "", type: "text" };
  }
  const o = raw as Record<string, unknown>;
  const type: CustomCardPropertyType =
    o.type === "textarea" ? "textarea" : "text";
  return {
    id: typeof o.id === "string" ? o.id : String(Date.now()),
    label: typeof o.label === "string" ? o.label : "",
    value: typeof o.value === "string" ? o.value : "",
    type,
  };
}

export function normalizeCustomCardData(raw: unknown): CustomCardData {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CUSTOM_CARD };
  const o = raw as Record<string, unknown>;
  return {
    title: typeof o.title === "string" ? o.title : "",
    properties: Array.isArray(o.properties)
      ? o.properties.map(normalizeCustomCardProperty)
      : [],
  };
}

// ─── Legacy card types (kept for backward compatibility) ──────────────────────

/** DAW plugin / instrument metadata (music memo plugin cards). */
export interface NotePluginData {
  name: string;
  category: string;
  purpose: string;
  isFavorite: boolean;
}

export const PLUGIN_CATEGORIES = [
  "Synth",
  "EQ",
  "Comp",
  "Reverb",
  "Delay",
  "Instrument",
  "Sample",
  "FX",
  "Other",
] as const;

export const DEFAULT_PLUGIN_DATA: NotePluginData = {
  name: "",
  category: "Synth",
  purpose: "",
  isFavorite: false,
};

/** Game design spec block (gamedev memos — enemy, skills, etc.). */
export interface NoteGameData {
  name: string;
  category: string;
  stats: string;
  description: string;
}

export const GAME_SPEC_CATEGORIES = [
  "Player",
  "Enemy",
  "Concept Attack",
  "Skill",
  "Item",
  "Boss",
  "Environment",
  "Other",
] as const;

export const DEFAULT_GAME_DATA: NoteGameData = {
  name: "",
  category: "Enemy",
  stats: "",
  description: "",
};

export interface NoteNode {
  id: string;
  content: string;
  children: NoteNode[];
  collapsed: boolean;
  completed: boolean;
  bgColor: string | null;
  headingLevel: HeadingLevel;
  hasCheckbox: boolean;
  note: string | null;
  /** Optional attachment: public Supabase Storage URL (see `freavia-images` bucket). */
  imageUrl: string | null;
  /** When set, the body renders as a plugin card instead of rich text. */
  pluginData?: NotePluginData;
  /** Gamedev memo: spec sheet card (mutually exclusive with pluginData in normalized form). */
  gameData?: NoteGameData;
  /** Generic custom property card — supersedes pluginData / gameData when present. */
  cardData?: CustomCardData;
}

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export function normalizeGameData(raw: unknown): NoteGameData {
  if (raw == null || typeof raw !== "object") return { ...DEFAULT_GAME_DATA };
  const o = raw as Record<string, unknown>;
  const cat = typeof o.category === "string" ? o.category : DEFAULT_GAME_DATA.category;
  return {
    name: typeof o.name === "string" ? o.name : "",
    category: cat,
    stats: typeof o.stats === "string" ? o.stats : "",
    description: typeof o.description === "string" ? o.description : "",
  };
}

export function createNode(partial?: Partial<NoteNode>): NoteNode {
  const { pluginData: pIn, gameData: gIn, cardData: cIn, id: idPartial, ...rest } = partial ?? {};
  let pluginData = pIn !== undefined ? normalizePluginData(pIn) : undefined;
  let gameData = gIn !== undefined ? normalizeGameData(gIn) : undefined;
  let cardData = cIn !== undefined ? normalizeCustomCardData(cIn) : undefined;
  // cardData takes priority; within legacy types they are mutually exclusive
  if (cardData) { pluginData = undefined; gameData = undefined; }
  else if (gameData) pluginData = undefined;
  else if (pluginData) gameData = undefined;

  const id =
    typeof idPartial === "string" && idPartial.length > 0 ? idPartial : createId();

  return {
    id,
    content: "",
    children: [],
    collapsed: false,
    completed: false,
    bgColor: null,
    headingLevel: null,
    hasCheckbox: false,
    note: null,
    imageUrl: null,
    ...rest,
    pluginData,
    gameData,
    cardData,
  };
}

export function normalizePluginData(raw: unknown): NotePluginData {
  if (raw == null || typeof raw !== "object") return { ...DEFAULT_PLUGIN_DATA };
  const o = raw as Record<string, unknown>;
  const cat = typeof o.category === "string" ? o.category : DEFAULT_PLUGIN_DATA.category;
  return {
    name: typeof o.name === "string" ? o.name : "",
    category: cat,
    purpose: typeof o.purpose === "string" ? o.purpose : "",
    isFavorite: Boolean(o.isFavorite),
  };
}

const LEGACY_BG_MAP: Record<string, string> = {
  blue: "#0c1a30",
  green: "#0a1a0a",
  purple: "#1a0a2a",
  amber: "#1a1205",
};

export function normalizeHeadingLevel(raw: unknown): HeadingLevel {
  if (raw == null || raw === "") return null;
  if (raw === "h1" || raw === "h2" || raw === "h3") return raw;
  if (typeof raw === "string") {
    const l = raw.trim().toLowerCase();
    if (l === "h1" || l === "h2" || l === "h3") return l;
  }
  return null;
}

/** Row tint + labels: hex / rgba / rgb / legacy preset keys — must round-trip through JSON (Supabase). */
export function normalizeNodeBgColor(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t || t === "transparent") return null;
  if (t.startsWith("#") && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/i.test(t)) return t;
  const parsed = parseStoredColor(t);
  if (parsed) return hexToRgba(parsed.hex, parsed.opacity);
  return LEGACY_BG_MAP[t] ?? null;
}

/**
 * Plain JSON-safe tree for persistence (explicit keys — same fields the editor reads).
 * Call before writing to Supabase `content.nodes`.
 */
export function cloneNoteTreeForPersistence(nodes: NoteNode[]): NoteNode[] {
  return nodes.map((n) => ({
    id: n.id,
    content: n.content,
    children: cloneNoteTreeForPersistence(n.children),
    collapsed: Boolean(n.collapsed),
    completed: Boolean(n.completed),
    bgColor: n.bgColor ?? null,
    headingLevel: n.headingLevel ?? null,
    hasCheckbox: Boolean(n.hasCheckbox),
    note: n.note ?? null,
    imageUrl: n.imageUrl && n.imageUrl.trim() ? n.imageUrl.trim() : null,
    ...(n.pluginData !== undefined ? { pluginData: n.pluginData } : {}),
    ...(n.gameData !== undefined ? { gameData: n.gameData } : {}),
    ...(n.cardData !== undefined ? { cardData: n.cardData } : {}),
  }));
}

export function normalizeNode(raw: Partial<NoteNode> & { children?: unknown }): NoteNode {
  const children = Array.isArray(raw.children)
    ? raw.children.map((child) =>
        normalizeNode((child ?? {}) as Partial<NoteNode> & { children?: unknown }),
      )
    : [];

  const cardRaw = (raw as Partial<NoteNode>).cardData;
  const cardData =
    cardRaw !== undefined && cardRaw !== null ? normalizeCustomCardData(cardRaw) : undefined;

  const pluginRaw = (raw as Partial<NoteNode>).pluginData;
  let pluginData =
    !cardData && pluginRaw !== undefined && pluginRaw !== null
      ? normalizePluginData(pluginRaw)
      : undefined;
  const gameRaw = (raw as Partial<NoteNode>).gameData;
  let gameData =
    !cardData && gameRaw !== undefined && gameRaw !== null
      ? normalizeGameData(gameRaw)
      : undefined;
  if (!cardData) {
    if (gameData) pluginData = undefined;
    else if (pluginData) gameData = undefined;
  }

  return createNode({
    id: raw.id,
    content: typeof raw.content === "string" ? raw.content : "",
    children,
    collapsed: Boolean(raw.collapsed),
    completed: raw.completed ?? false,
    bgColor: normalizeNodeBgColor(raw.bgColor),
    headingLevel: normalizeHeadingLevel(raw.headingLevel),
    hasCheckbox: raw.hasCheckbox ?? false,
    note: raw.note ?? null,
    imageUrl:
      typeof raw.imageUrl === "string" && raw.imageUrl.trim() ? raw.imageUrl.trim() : null,
    pluginData,
    gameData,
    cardData,
  });
}
