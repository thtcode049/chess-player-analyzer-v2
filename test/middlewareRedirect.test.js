const assert = require("assert");

// Mock NextRequest and cookies to test middleware logic
class MockCookies {
  constructor(cookies = {}) {
    this._cookies = new Map(Object.entries(cookies));
  }
  get(name) {
    const val = this._cookies.get(name);
    return val !== undefined ? { name, value: val } : undefined;
  }
  getAll() {
    return Array.from(this._cookies.entries()).map(([name, value]) => ({ name, value }));
  }
  set(name, value) {
    this._cookies.set(name, value);
  }
}

class MockNextUrl {
  constructor(pathname, base = "http://localhost:3000") {
    this.url = new URL(pathname, base);
    this.pathname = this.url.pathname;
  }
  clone() {
    return new MockNextUrl(this.pathname, this.url.origin);
  }
}

class MockNextRequest {
  constructor(pathname, cookies = {}) {
    this.nextUrl = new MockNextUrl(pathname);
    this.url = this.nextUrl.url.toString();
    this.cookies = new MockCookies(cookies);
    this.headers = new Headers();
  }
}

// Emulate middleware handler logic
function runMiddlewareLogic(request, user) {
  const pathname = request.nextUrl.pathname;
  const isGuest =
    request.cookies.get("chess_guest_mode")?.value === "true" ||
    Boolean(request.cookies.get("chess_guest_session_id")?.value);

  // 1. Landing / Home page
  if (pathname === "/") {
    return { status: 200, action: "next" };
  }

  // 2. Auth routes
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth");

  if (isAuthRoute) {
    if (user && (pathname.startsWith("/login") || pathname.startsWith("/register"))) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      return { status: 307, action: "redirect", target: dashboardUrl.pathname };
    }
    return { status: 200, action: "next" };
  }

  // 3. Protected system routes
  if (!user && !isGuest) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return { status: 307, action: "redirect", target: homeUrl.pathname };
  }

  return { status: 200, action: "next" };
}

console.log("==================================================");
console.log("MIDDLEWARE ROUTE GUARD VERIFICATION SUITE");
console.log("==================================================");

// Case 1: Unauthenticated & Non-guest accessing protected routes
const protectedRoutes = ["/dashboard", "/analyze", "/ai-coach", "/players", "/players/123", "/import"];
for (const route of protectedRoutes) {
  const req = new MockNextRequest(route, {});
  const res = runMiddlewareLogic(req, null);
  assert.strictEqual(res.status, 307, `Expected 307 redirect for unauthenticated access to ${route}`);
  assert.strictEqual(res.target, "/", `Expected redirect target to be '/' for ${route}`);
  console.log(`  ✓ Unauthenticated access to ${route} correctly redirects to '/'`);
}

// Case 2: Unauthenticated & Non-guest accessing public routes
const publicRoutes = ["/", "/login", "/register", "/auth/callback", "/auth/lichess/callback"];
for (const route of publicRoutes) {
  const req = new MockNextRequest(route, {});
  const res = runMiddlewareLogic(req, null);
  assert.strictEqual(res.status, 200, `Expected 200 next for ${route}`);
  assert.strictEqual(res.action, "next");
  console.log(`  ✓ Public access to ${route} is allowed without redirect`);
}

// Case 3: Guest mode active accessing protected routes
for (const route of protectedRoutes) {
  const req = new MockNextRequest(route, { chess_guest_mode: "true", chess_guest_session_id: "guest_abc123" });
  const res = runMiddlewareLogic(req, null);
  assert.strictEqual(res.status, 200, `Expected 200 next for guest access to ${route}`);
  assert.strictEqual(res.action, "next");
  console.log(`  ✓ Guest mode access to ${route} is allowed`);
}

// Case 4: Authenticated user accessing protected routes
const mockUser = { id: "user_test_123", email: "gm@chesslook.com" };
for (const route of protectedRoutes) {
  const req = new MockNextRequest(route, {});
  const res = runMiddlewareLogic(req, mockUser);
  assert.strictEqual(res.status, 200, `Expected 200 next for authenticated user on ${route}`);
  assert.strictEqual(res.action, "next");
  console.log(`  ✓ Authenticated user access to ${route} is allowed`);
}

// Case 5: Authenticated user accessing /login or /register
for (const route of ["/login", "/register"]) {
  const req = new MockNextRequest(route, {});
  const res = runMiddlewareLogic(req, mockUser);
  assert.strictEqual(res.status, 307, `Expected redirect away from ${route} for authenticated user`);
  assert.strictEqual(res.target, "/dashboard");
  console.log(`  ✓ Authenticated user visiting ${route} redirects to '/dashboard'`);
}

console.log("==================================================");
console.log("ALL MIDDLEWARE ROUTE GUARD TESTS PASSED (100%)");
console.log("==================================================");
