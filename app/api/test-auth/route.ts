import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({
      ok: false,
      error: "Missing env vars",
      url: url ? "SET" : "MISSING",
      key: key ? "SET" : "MISSING",
    });
  }

  try {
    // Test signUp call
    const res = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        email: `debugtest_${Date.now()}@test.com`,
        password: "Test123456!",
      }),
    });

    const data = await res.json();

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      url_used: url,
      key_prefix: key.substring(0, 20) + "...",
      response: data,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message });
  }
}
