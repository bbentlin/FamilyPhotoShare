import { NextRequest, NextResponse } from " next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return new NextResponse("Missing u", { status: 400 });
  try {
    const url = new URL(u);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return new NextResponse("Invalid protocol", { status: 400 });
    }

    const upstream = await fetch(url.toString(), {
      // Avoid 304/CORS cache quirks
      cache: "no-store",
      // Forward only safe headers
      headers: {
        Accept: req.headers.get("accept") ?? "*/*",
        "User-Agent": req.headers.get("user-agent") ?? "",
      },
    });

    if (!upstream.ok && upstream.status !== 304) {
      return new NextResponse(`Upstream error ${upstream.status}`, {
        status: upstream.status,
      });
    }

    const res = new NextResponse(upstream.body, { status: upstream.status });
    // Preserve important headers
    const ct = upstream.headers.get("content-type") ?? "image/jpeg";
    res.headers.set("content-type", ct);
    res.headers.set("cache-control", "public, max-age=3600");
    const etag = upstream.headers.get("etag");
    if (etag) res.headers.set("etag", etag);
    return res;
  } catch (e) {
    return new NextResponse("Bad URL", { status: 400 });
  }
}