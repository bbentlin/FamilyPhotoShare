import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return new NextResponse("Missing u", { status: 400 });

  // Fetch upstream without relying on cache to avoid 304 edge-cases
  const upstream = await fetch(u, { cache: "no-store" });

  const res = new NextResponse(upstream.body,  {
    status: upstream.status,
  });

  // Preserve common headers
  const ct = upstream.headers.get("Content-Type") ?? "image/jpeg";
  res.headers.set("Content-Type", ct);
  res.headers.set("Cache-Control", "public, max-age=3600");
  const etag = upstream.headers.get("ETag");
  if (etag) res.headers.set("ETag", etag);

  return res;
}