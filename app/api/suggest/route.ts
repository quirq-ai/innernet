import { suggest } from "@/lib/search";
import { getUiConfig } from "@/lib/ui-config";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const { search } = getUiConfig();
  return Response.json(search.suggestions ? suggest(q.slice(0, 200), search.suggestionLimit) : [], { headers: { "Cache-Control": "no-store" } });
}
