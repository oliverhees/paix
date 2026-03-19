import { NextResponse } from "next/server";

/**
 * Frontend health check endpoint.
 * Used by Docker healthcheck to verify the Next.js app is running.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "paione-web",
    timestamp: new Date().toISOString(),
  });
}
