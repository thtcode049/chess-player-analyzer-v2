"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

function LichessCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const hasExecutedRef = useRef<boolean>(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      setStatus("error");
      setErrorMessage("Không tìm thấy mã xác thực từ Lichess.");
      return;
    }

    if (typeof window === "undefined") return;

    // Fast-path: Check if this code was already successfully exchanged
    const existingToken = sessionStorage.getItem("lichess_token") || localStorage.getItem("lichess_token");
    const lastProcessedCode = sessionStorage.getItem("lichess_last_processed_code");
    if (existingToken && lastProcessedCode === code) {
      setStatus("success");
      const returnUrl =
        localStorage.getItem("lichess_oauth_return_url") ||
        sessionStorage.getItem("lichess_oauth_return_url") ||
        "/dashboard";
      setTimeout(() => {
        window.location.href = returnUrl;
      }, 500);
      return;
    }

    // Prevent double execution in React Strict Mode or concurrent re-renders
    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;
    try {
      sessionStorage.setItem("lichess_last_processed_code", code);
    } catch {}

    const savedVerifier = localStorage.getItem("lichess_oauth_verifier");
    const savedState = localStorage.getItem("lichess_oauth_state");

    if (savedState && state && savedState !== state) {
      setStatus("error");
      setErrorMessage("Mã bảo mật OAuth state không khớp hoặc phiên đăng nhập đã hết hạn.");
      return;
    }

    if (!savedVerifier) {
      // If we don't have a verifier but we already have a valid token (e.g. from an earlier concurrent call that cleaned up), treat as success
      if (existingToken) {
        setStatus("success");
        const returnUrl =
          localStorage.getItem("lichess_oauth_return_url") ||
          sessionStorage.getItem("lichess_oauth_return_url") ||
          "/dashboard";
        setTimeout(() => {
          window.location.href = returnUrl;
        }, 500);
        return;
      }
      setStatus("error");
      setErrorMessage("Không tìm thấy mã kiểm chứng PKCE. Vui lòng bấm 'Ủy quyền Lichess' lại.");
      return;
    }

    const redirectUri = `${window.location.origin}/auth/lichess/callback`;
    const clientId = window.location.origin;

    apiClient
      .exchangeLichessCode({
        code,
        code_verifier: savedVerifier,
        redirect_uri: redirectUri,
        client_id: clientId,
      })
      .then((res) => {
        if (res.access_token) {
          try {
            sessionStorage.setItem("lichess_token", res.access_token);
            localStorage.setItem("lichess_token", res.access_token);
            if (res.username) {
              sessionStorage.setItem("lichess_username", res.username);
              localStorage.setItem("lichess_username", res.username);
            }
          } catch {}
          setStatus("success");

          // Clean up temporary PKCE values
          try {
            localStorage.removeItem("lichess_oauth_verifier");
            localStorage.removeItem("lichess_oauth_state");
            sessionStorage.removeItem("lichess_oauth_verifier");
            sessionStorage.removeItem("lichess_oauth_state");
          } catch {}

          const returnUrl =
            localStorage.getItem("lichess_oauth_return_url") ||
            sessionStorage.getItem("lichess_oauth_return_url") ||
            "/dashboard";
          try {
            localStorage.removeItem("lichess_oauth_return_url");
            sessionStorage.removeItem("lichess_oauth_return_url");
          } catch {}

          // Redirect back after a brief confirmation
          setTimeout(() => {
            window.location.href = returnUrl;
          }, 800);
        } else {
          // If token exchange returned error but token already exists in storage, ignore error
          const currentToken = sessionStorage.getItem("lichess_token") || localStorage.getItem("lichess_token");
          if (currentToken) {
            setStatus("success");
            const returnUrl =
              localStorage.getItem("lichess_oauth_return_url") ||
              sessionStorage.getItem("lichess_oauth_return_url") ||
              "/dashboard";
            setTimeout(() => {
              window.location.href = returnUrl;
            }, 600);
            return;
          }
          setStatus("error");
          setErrorMessage(res.error || "Không nhận được Access Token từ Lichess.");
        }
      })
      .catch((err: any) => {
        // If an earlier concurrent call already succeeded and saved the token, ignore the consumed code error!
        const currentToken = sessionStorage.getItem("lichess_token") || localStorage.getItem("lichess_token");
        const errMsg = String(err?.message || "");
        const isConsumed = errMsg.includes("consumed") || errMsg.includes("invalid_grant");

        if (currentToken && isConsumed) {
          setStatus("success");
          const returnUrl =
            localStorage.getItem("lichess_oauth_return_url") ||
            sessionStorage.getItem("lichess_oauth_return_url") ||
            "/dashboard";
          setTimeout(() => {
            window.location.href = returnUrl;
          }, 600);
          return;
        }

        setStatus("error");
        setErrorMessage(errMsg || "Lỗi khi trao đổi mã xác thực với máy chủ Lichess.");
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-md max-w-md w-full p-8 shadow-sm text-center space-y-5">
        {status === "loading" && (
          <>
            <div className="w-12 h-12 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Đang kết nối tài khoản Lichess</h2>
              <p className="text-xs text-slate-500 mt-1.5">
                Vui lòng đợi trong giây lát để hệ thống lưu ủy quyền và kích hoạt Master Database...
              </p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Ủy quyền Lichess thành công!</h2>
              <p className="text-xs text-emerald-600 font-medium mt-1.5">
                Đã ghi nhớ tài khoản. Đang đưa bạn quay trở lại ứng dụng...
              </p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-12 h-12 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Ủy quyền chưa thành công</h2>
              <p className="text-xs text-red-600 mt-1.5 bg-red-50 p-3 rounded border border-red-200">
                {errorMessage}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-xs font-medium px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại Tổng quan</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LichessCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <LichessCallbackContent />
    </Suspense>
  );
}
