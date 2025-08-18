import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

export async function GET(reg: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return new NextResponse("Missing u", { status: 400 });

  try {
    const url = new URL(u);
    if (!["http:", "https:"].includes(url.protocol)) {
      return new NextResponse("Invalid protocol", { status: 400 });
    }
    if (!ALLOWED_HOSTS.has(url.hostname)) {
      return new NextResponse("Host not allowed", { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const upstream = await fetch(url.toString(), {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!upstream.ok && upstream.status !== 304) {
      return new NextResponse(`Upstream error ${upstream.status}`, {
        status: upstream.status,
      });
    }

    const res = new NextResponse(upstream.body, { status: upstream.status });
    const ct = upstream.headers.get("content-type") ?? "image/jpeg";
    res.headers.set("content-type", ct);
    res.headers.set("cache-control", "public, max-age=3600");
    const etag = upstream.headers.get("etag");
    if (etag) res.headers.set("etag", etag);
    res.headers.set("x-content-type-options", "nosniff")
    res.headers.set("content-disposition", "inline");
    return res;
  } catch {
    return new NextResponse("Bad URL", { status: 400 });
  }
}