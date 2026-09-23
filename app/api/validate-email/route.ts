import { NextResponse } from "next/server";
import { promises as dns } from "dns";

// Danh sách các tên miền email tạm thời / rác phổ biến
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "sharklasers.com",
  "yopmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "getairmail.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "emailondeck.com",
  "crazymailing.com",
]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!rawEmail) {
      return NextResponse.json(
        { valid: false, message: "Vui lòng nhập địa chỉ email." },
        { status: 400 }
      );
    }

    // 1. Kiểm tra cấu trúc Email cơ bản bằng Regex RFC 5322
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(rawEmail)) {
      return NextResponse.json(
        { valid: false, message: "Định dạng email không hợp lệ (ví dụ: tenban@gmail.com)." },
        { status: 400 }
      );
    }

    const [username, domain] = rawEmail.split("@");

    if (!username || !domain) {
      return NextResponse.json(
        { valid: false, message: "Email phải bao gồm phần tên người dùng và tên miền hợp lệ." },
        { status: 400 }
      );
    }

    // 2. Chặn các tên miền email tạm thời / rác
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      return NextResponse.json(
        { valid: false, message: "Hệ thống không chấp nhận email tạm thời/dùng một lần. Vui lòng dùng email chính thức." },
        { status: 400 }
      );
    }

    // 3. Quy tắc riêng cho Gmail (@gmail.com / @googlemail.com)
    if (domain === "gmail.com" || domain === "googlemail.com") {
      // Username Gmail phải từ 6 đến 30 ký tự
      if (username.length < 6 || username.length > 30) {
        return NextResponse.json(
          { valid: false, message: "Tên tài khoản Gmail phải có độ dài từ 6 đến 30 ký tự." },
          { status: 400 }
        );
      }

      // Gmail chỉ chấp nhận chữ cái a-z, số 0-9 và dấu chấm .
      if (!/^[a-z0-9.]+$/.test(username)) {
        return NextResponse.json(
          { valid: false, message: "Tên tài khoản Gmail chỉ được chứa chữ cái, số và dấu chấm (.), không được chứa ký tự đặc biệt." },
          { status: 400 }
        );
      }

      // Gmail không được có 2 dấu chấm liên tiếp, hoặc bắt đầu/kết thúc bằng dấu chấm
      if (username.startsWith(".") || username.endsWith(".") || username.includes("..")) {
        return NextResponse.json(
          { valid: false, message: "Tên tài khoản Gmail không thể bắt đầu, kết thúc hoặc chứa hai dấu chấm liên tiếp." },
          { status: 400 }
        );
      }
    }

    // 4. Kiểm tra DNS MX Records (Tên miền có máy chủ nhận mail thực tế hay không)
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return NextResponse.json(
          { valid: false, message: `Tên miền "@${domain}" không có máy chủ nhận email (không có bản ghi MX). Vui lòng kiểm tra lại.` },
          { status: 400 }
        );
      }
    } catch (dnsErr: any) {
      const code = dnsErr.code || "";
      if (code === "ENOTFOUND" || code === "ENODATA") {
        return NextResponse.json(
          { valid: false, message: `Tên miền "@${domain}" không tồn tại trên hệ thống máy chủ mạng.` },
          { status: 400 }
        );
      }
      // Trong trường hợp lỗi timeout mạng DNS tạm thời, không chặn người dùng nếu là các domain phổ biến
      const popularDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"];
      if (!popularDomains.includes(domain)) {
        return NextResponse.json(
          { valid: false, message: `Không thể xác thực máy chủ email cho tên miền "@${domain}". Vui lòng sử dụng địa chỉ email khác.` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ valid: true });
  } catch (error: any) {
    console.error("[Validate Email] Server error:", error);
    return NextResponse.json(
      { valid: true }, // Fail-open on unexpected system error to not lock out users
      { status: 200 }
    );
  }
}
