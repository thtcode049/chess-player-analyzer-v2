/**
 * Centralized Lichess OAuth 2.0 PKCE Authorization Helper
 * ---------------------------------------------------------
 * Allows single-sign-on (1-click authorization) with Lichess.
 * Stores the resulting access token and username in localStorage,
 * which is shared seamlessly between:
 * - Import Games page (/import)
 * - Opening Tree Variations table (OpeningTreeTable)
 * - Interactive Chessboard analysis (/analyze)
 * - Profile dashboards (/players/[id])
 *
 * Once authorized, the user never needs to authorize again.
 */

export function generateRandomString(length = 64): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let text = "";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    text += possible[values[i] % possible.length];
  }
  return text;
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Initiates the Lichess OAuth 2.0 PKCE flow.
 * Stores state and PKCE verifier into localStorage before redirecting to Lichess.
 * @param returnUrl The page URL to return to after successful authorization.
 */
export async function initiateLichessOAuth(returnUrl?: string): Promise<void> {
  if (typeof window === "undefined") return;

  const verifier = generateRandomString(64);
  const challenge = await generateCodeChallenge(verifier);
  const state = generateRandomString(16);

  const fallbackReturnUrl = window.location.href;
  const targetReturnUrl = returnUrl || fallbackReturnUrl;

  localStorage.setItem("lichess_oauth_verifier", verifier);
  localStorage.setItem("lichess_oauth_state", state);
  localStorage.setItem("lichess_oauth_return_url", targetReturnUrl);

  const redirectUri = `${window.location.origin}/auth/lichess/callback`;
  const clientId = window.location.origin;

  const authUrl = new URL("https://lichess.org/oauth");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("scope", "");
  authUrl.searchParams.set("state", state);

  window.location.href = authUrl.toString();
}

/**
 * Retrieves the currently saved Lichess authentication information.
 */
export function getLichessAuth(): { isAuthorized: boolean; token: string; username: string } {
  if (typeof window === "undefined") {
    return { isAuthorized: false, token: "", username: "" };
  }
  const token = (localStorage.getItem("lichess_token") || "").trim();
  const username = (localStorage.getItem("lichess_username") || "").trim();
  const isAuthorized = Boolean(token && token.length >= 10);
  return { isAuthorized, token, username };
}

/**
 * Disconnects the Lichess account and clears stored tokens.
 */
export function disconnectLichessAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("lichess_token");
  localStorage.removeItem("lichess_username");
  localStorage.removeItem("lichess_oauth_verifier");
  localStorage.removeItem("lichess_oauth_state");
  localStorage.removeItem("lichess_oauth_return_url");
}
