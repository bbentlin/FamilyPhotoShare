import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean) as string[];

function originAllowed(origin: string | null) {
  if (!origin) return true; // same-origin
  return ALLOWED_ORIGINS.includes(origin);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(request: NextRequest) {
  if (!originAllowed(request.headers.get("origin"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    const body = await request.json();
    const to = body.to;
    const subject = body.subject ?? "Notification";
    const message: string = body.message ?? "";
    const html: string | undefined = body.html;
    const typeText =
      typeof body.type === "string"
        ? String(body.type).replace(/_/g, " ")
        : "notification";

    await transporter.sendMail({
      from: `"Family Photo Share" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html:
        html ??
        `
        <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif">
          <p style="margin:0;white-space:pre-wrap">${message}</p>
          <p style="margin-top:12px;color:#6b7280;font-size:12px">
            You are receiving this ${typeText} email from Family Photo Share.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Email error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
