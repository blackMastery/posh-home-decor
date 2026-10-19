import {
  DIMS,
  SHOW_FLAGS,
  type Attribute,
  type DimKey,
  type FacetResult,
  type Range,
  type ShopFilters,
  type ShowFlag,
} from "./types";

// Shop filter <-> URL params. Shared by the shop page, the facets route and the
// filter UI, so a URL always means the same thing everywhere.
//
//   ?color=gold,black&material=glass   attribute values (slugs)
//   ?price=5000-20000  ?h=20-40  ?dia=-30   ranges (either bound optional)
//   ?new=1&sale=1&soon=1                New in / On sale / Coming soon (OR'd)
//   ?instock=1                          hide sold out

const PRICE_PARAM = "price";
const IN_STOCK_PARAM = "instock";
const MAX_VALUES = 30;

/** Every param a filter can own (attribute slugs come on top of these). */
export const FILTER_PARAMS = [PRICE_PARAM, IN_STOCK_PARAM, ...DIMS.map((d) => d.param), ...SHOW_FLAGS.map((f) => f.param)];

/** Landing routes that preset one New / Sale / Coming soon toggle. */
export const PRESET_ROUTES: Record<ShowFlag, string> = { new: "/shop/new", sale: "/shop/sale", "coming-soon": "/shop/coming-soon" };

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function getter(source: ParamSource) {
  if (source instanceof URLSearchParams) return (key: string) => source.get(key) ?? "";
  return (key: string) => {
    const v = source[key];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
}

export function emptyFilters(): ShopFilters {
  return { values: {}, price: null, dims: {}, show: [], hideSoldOut: false };
}

function parseRange(raw: string, integer: boolean): Range | null {
  const m = /^\s*(\d+(?:\.\d+)?)?\s*-\s*(\d+(?:\.\d+)?)?\s*$/.exec(raw);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  const num = (s: string | undefined) => {
    if (s === undefined) return null;
    const n = integer ? Math.round(Number(s)) : Math.round(Number(s) * 10) / 10;
    return Number.isFinite(n) && n >= 0 && n < 1e9 ? n : null;
  };
  let min = num(m[1]);
  let max = num(m[2]);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return min === null && max === null ? null : { min, max };
}

function formatRange(r: Range) {
  return `${r.min ?? ""}-${r.max ?? ""}`;
}

/** Read filters from URL params, dropping unknown attributes/values. */
export function parseFilters(source: ParamSource, attributes: Attribute[], preset?: ShowFlag | null): ShopFilters {
  const get = getter(source);
  const f = emptyFilters();
  for (const a of attributes) {
    const known = new Set(a.values.map((v) => v.slug));
    const picked = [...new Set(get(a.slug).split(","))].filter((s) => known.has(s)).slice(0, MAX_VALUES);
    if (picked.length) f.values[a.slug] = picked;
  }
  f.price = parseRange(get(PRICE_PARAM), true);
  for (const d of DIMS) {
    const r = parseRange(get(d.param), false);
    if (r) f.dims[d.key] = r;
  }
  f.show = SHOW_FLAGS.filter((s) => s.value === preset || get(s.param) === "1").map((s) => s.value);
  f.hideSoldOut = get(IN_STOCK_PARAM) === "1";
  return f;
}

/** Write filters into params (removing any previous filter params). */
export function writeFilters(params: URLSearchParams, f: ShopFilters, attributes: Attribute[], preset?: ShowFlag | null) {
  for (const key of [...FILTER_PARAMS, ...attributes.map((a) => a.slug)]) params.delete(key);
  for (const a of attributes) {
    const picked = f.values[a.slug];
    if (picked?.length) {
      // Stable order (as listed in admin) so equivalent filters share a URL.
      const order = new Map(a.values.map((v, i) => [v.slug, i]));
      params.set(a.slug, [...picked].sort((x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0)).join(","));
    }
  }
  if (f.price) params.set(PRICE_PARAM, formatRange(f.price));
  for (const d of DIMS) {
    const r = f.dims[d.key];
    if (r) params.set(d.param, formatRange(r));
  }
  for (const s of SHOW_FLAGS) if (s.value !== preset && f.show.includes(s.value)) params.set(s.param, "1");
  if (f.hideSoldOut) params.set(IN_STOCK_PARAM, "1");
  return params;
}

/**
 * Build a shop URL. On a preset landing page (/shop/sale) the preset toggle is
 * implied by the path; switching it off moves to /shop.
 */
export function shopHref(opts: {
  basePath: string;
  preset?: ShowFlag | null;
  filters: ShopFilters;
  attributes: Attribute[];
  current?: URLSearchParams;
}) {
  const { filters, attributes } = opts;
  let path = opts.basePath;
  let preset = opts.preset ?? null;
  if (preset && !filters.show.includes(preset)) {
    path = "/shop";
    preset = null;
  }
  const params = new URLSearchParams(opts.current);
  params.delete("page");
  writeFilters(params, filters, attributes, preset);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Number of active selections (for the "Filter (3)" button). */
export function countActive(f: ShopFilters, preset?: ShowFlag | null) {
  return (
    Object.values(f.values).reduce((n, v) => n + v.length, 0) +
    (f.price ? 1 : 0) +
    Object.keys(f.dims).length +
    f.show.filter((s) => s !== preset).length +
    (f.hideSoldOut ? 1 : 0)
  );
}

export function hasActiveFilters(f: ShopFilters, preset?: ShowFlag | null) {
  return countActive(f, preset) > 0;
}

export function toggleValue(f: ShopFilters, attribute: string, value: string): ShopFilters {
  const current = f.values[attribute] ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const values = { ...f.values };
  if (next.length) values[attribute] = next;
  else delete values[attribute];
  return { ...f, values };
}

export function toggleShow(f: ShopFilters, flag: ShowFlag): ShopFilters {
  return { ...f, show: f.show.includes(flag) ? f.show.filter((s) => s !== flag) : [...f.show, flag] };
}

export function setPrice(f: ShopFilters, range: Range | null): ShopFilters {
  return { ...f, price: range && (range.min !== null || range.max !== null) ? range : null };
}

export function setDim(f: ShopFilters, dim: DimKey, range: Range | null): ShopFilters {
  const dims = { ...f.dims };
  if (range && (range.min !== null || range.max !== null)) dims[dim] = range;
  else delete dims[dim];
  return { ...f, dims };
}

/** Clear everything except the landing page's preset. */
export function clearFilters(preset?: ShowFlag | null): ShopFilters {
  return { ...emptyFilters(), show: preset ? [preset] : [] };
}

/**
 * Drop selections the current listing can't satisfy: values not used by any
 * product in scope (e.g. after switching category) and dimensions the
 * category doesn't filter on.
 */
export function pruneFilters(f: ShopFilters, facets: FacetResult, dims: DimKey[]): ShopFilters {
  const inScope = new Set(facets.values.map((v) => `${v.attribute}=${v.value}`));
  const values: ShopFilters["values"] = {};
  for (const [attr, picked] of Object.entries(f.values)) {
    const kept = picked.filter((v) => inScope.has(`${attr}=${v}`));
    if (kept.length) values[attr] = kept;
  }
  const keptDims: ShopFilters["dims"] = {};
  for (const d of dims) if (f.dims[d]) keptDims[d] = f.dims[d];
  return { ...f, values, dims: keptDims };
}

export function sameFilters(a: ShopFilters, b: ShopFilters) {
  const norm = (f: ShopFilters) =>
    JSON.stringify({
      v: Object.keys(f.values)
        .sort()
        .map((k) => [k, [...f.values[k]].sort()]),
      p: f.price,
      d: DIMS.map((d) => f.dims[d.key] ?? null),
      s: [...f.show].sort(),
      h: f.hideSoldOut,
    });
  return norm(a) === norm(b);
}

/** Arguments shared by the shop_products / shop_facets RPCs. */
export function toRpcFilters(f: ShopFilters) {
  const dims: Record<string, [number | null, number | null]> = {};
  for (const [k, r] of Object.entries(f.dims)) if (r) dims[k] = [r.min, r.max];
  return {
    p_values: f.values,
    p_price_min: f.price?.min ?? undefined,
    p_price_max: f.price?.max ?? undefined,
    p_dims: dims,
    p_show: f.show,
    p_hide_sold_out: f.hideSoldOut,
  };
}
