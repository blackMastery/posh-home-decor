import type { NextRequest } from "next/server";
import { getSearchSuggestions } from "@/lib/data/catalog";

/** Header search overlay: a few products and categories for the typed text. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (q.length < 2) return Response.json({ products: [], categories: [] });
  const suggestions = await getSearchSuggestions(q.toLowerCase());
  return Response.json(suggestions, { headers: { "Cache-Control": "public, max-age=60" } });
}
