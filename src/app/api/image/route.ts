import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return new NextResponse("Missing u", { status: 400 });

  // Optional: width/quality/format hints
  const w = Number(req.nextUrl.searchParams.get("w") || "0");
  const q = Number(req.nextUrl.searchParams.get("q") || "0");
  const fmt = req.nextUrl.searchParams.get("fmt") || ""; // "webp" | "jpeg" | ""

  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return new NextResponse("Bad URL", { status: 400 });
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return new NextResponse("Invalid protocol", { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return new NextResponse("Host not allowed", { status: 400 });
  }

  // Relay validators to upstream
  const upstreamHeaders: Record<string, string> = {};
  const ifNoneMatch = req.headers.get("if-none-match");
  const ifModifiedSince = req.headers.get("if-modified-since");
  if (ifNoneMatch) upstreamHeaders["if-none-match"] = ifNoneMatch;
  if (ifModifiedSince) upstreamHeaders["if-modified-since"] = ifModifiedSince;
  const accept = req.headers.get("accept") || "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const upstream = await fetch(url.toString(), {
      // Let the CDN cache this response; we manage caching via headers below
      cache: "force-cache",
      redirect: "follow",
      headers: upstreamHeaders,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (upstream.status === 304) {
      const notModified = new NextResponse(null, { status: 304 });
      notModified.headers.set(
        "CDN-Cache-Control",
        "public, s-maxage=86400, stale-while-revalidate=604800"
      );
      notModified.headers.set(
        "Cache-Control",
        "public, max-age=3600, stale-while-revalidate=86400"
      );
      return notModified;
    }
    if (!upstream.ok) {
      return new NextResponse(`Upstream error ${upstream.status}`, {
        status: upstream.status,
      });
    }

    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";
    const isImage = contentType.startsWith("image/");
    if (!isImage) {
      // Just pass it through if not an image
      const res = new NextResponse(upstream.body, { status: upstream.status });
      res.headers.set("content-type", contentType);
      res.headers.set(
        "CDN-Cache-Control",
        "public, s-maxage=3600, stale-while-revalidate=86400"
      );
      res.headers.set(
        "Cache-Control",
        "public, max-age=3600, stale-while-revalidate=86400"
      );
      return res;
    }

    // Animated GIFs or SVGs: don't transform (preserve animation/vector)
    const isGif = contentType.includes("gif");
    const isSvg = contentType.includes("svg");
    const shouldTransform = !isGif && !isSvg;

    const arrayBuf = await upstream.arrayBuffer();
    // Use Uint8Array to avoid TS Buffer generic mismatch; sharp accepts it
    let bin = new Uint8Array(arrayBuf);

    if (shouldTransform) {
      const targetW = w ? clamp(Math.round(w), 64, 2400) : 0;
      const quality = q ? clamp(Math.round(q), 40, 90) : 75;

      let pipeline = sharp(bin, { failOnError: false }).rotate();
      if (targetW > 0) {
        pipeline = pipeline.resize({
          width: targetW,
          withoutEnlargement: true,
        });
      }

      const wantWebp =
        fmt === "webp" || (!fmt && accept.includes("image/webp"));
      const out = wantWebp
        ? await pipeline.webp({ quality }).toBuffer()
        : contentType.includes("jpeg") || fmt === "jpeg" || fmt === "jpg"
        ? await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer()
        : contentType.includes("png") || fmt === "png"
        ? await pipeline.png({ quality }).toBuffer()
        : await pipeline.webp({ quality }).toBuffer();
      bin = new Uint8Array(out); // Convert Buffer to Uint8Array
    }

    // Simple ETag for CDN/browser validation
    const etag = `W/"${crypto.createHash("sha1").update(bin).digest("hex")}"`;

    const resp = new NextResponse(bin, { status: 200 });
    resp.headers.set(
      "content-type",
      shouldTransform
        ? fmt === "webp" || accept.includes("image/webp")
          ? "image/webp"
          : contentType
        : contentType
    );
    resp.headers.set("etag", etag);
    // Cache hard at CDN, modestly in browser
    resp.headers.set(
      "CDN-Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=604800"
    );
    resp.headers.set(
      "Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400"
    );
    resp.headers.set("x-content-type-options", "nosniff");
    resp.headers.set("content-disposition", "inline");
    return resp;
  } catch (e) {
    return new NextResponse("Proxy error", { status: 502 });
  }
}
