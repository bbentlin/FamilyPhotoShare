import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  "http://localhost:3000",
].filter(Boolean) as string[];

function originAllowed(origin: string | null) {
  if (!origin) return false;
  try {
    const o = new URL(origin);
    return ALLOWED_ORIGINS.some((allowed) => {
      const a = new URL(allowed);
      return a.host === o.host && a.protocol === o.protocol;
    });
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request.headers.get("origin"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const { to, subject, message, type } = await request.json();

    // Create transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER, // Your Gmail address
        pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password
      },
    });

    const mailOptions = {
      from: `"Family Photo Share" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 20px;">
          <div style="background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0; font-size: 24px; font-weight: bold;">📸 Family Photo Share</h1>
            </div>
            
            <h2 style="color: #1f2937; margin-bottom: 20px; font-size: 20px;">${subject}</h2>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
                ${message}
              </p>
            </div>
            
            <div style="margin-top: 30px; padding: 15px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                💡 <strong>Notification Settings:</strong> This email was sent because you have "${type.replace(
                  "_",
                  " "
                )}" notifications enabled.<br>
                You can change your notification preferences in your Family Photo Share settings.
              </p>
            </div>
            
            <div style="margin-top: 30px; text-align: center; padding: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                Family Photo Share - Keeping families connected through memories ❤️
              </p>
            </div>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}`);

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return NextResponse.json(
      {
        error: "Failed to send email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
