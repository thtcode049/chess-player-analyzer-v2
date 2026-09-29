"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

function LichessCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      setStatus("error");
      setErrorMessage("Không tìm thấy mã xác thực từ Lichess.");
      return;
    }

    if (typeof window === "undefined") return;

    const savedVerifier = localStorage.getItem("lichess_oauth_verifier");
    const savedState = localStorage.getItem("lichess_oauth_state");

    if (savedState && state && savedState !== state) {
      setStatus("error");
      setErrorMessage("Mã bảo mật OAuth state không khớp hoặc phiên đăng nhập đã hết hạn.");
      return;
    }

    if (!savedVerifier) {
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
          localStorage.setItem("lichess_token", res.access_token);
          if (res.username) {
            localStorage.setItem("lichess_username", res.username);
          }
          setStatus("success");

          // Clean up temporary PKCE values
          localStorage.removeItem("lichess_oauth_verifier");
          localStorage.removeItem("lichess_oauth_state");

          const returnUrl = localStorage.getItem("lichess_oauth_return_url") || "/dashboard";
          localStorage.removeItem("lichess_oauth_return_url");

          // Redirect back after a brief confirmation
          setTimeout(() => {
            window.location.href = returnUrl;
          }, 800);
        } else {
          setStatus("error");
          setErrorMessage(res.error || "Không nhận được Access Token từ Lichess.");
        }
      })
      .catch((err: any) => {
        setStatus("error");
        setErrorMessage(err.message || "Lỗi khi trao đổi mã xác thực với máy chủ Lichess.");
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-8 shadow-2xl text-center space-y-5">
        {status === "loading" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Đang kết nối tài khoản Lichess</h2>
              <p className="text-xs text-slate-400 mt-1.5">
                Vui lòng đợi trong giây lát để hệ thống lưu ủy quyền và kích hoạt Master Database...
              </p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Ủy quyền Lichess thành công!</h2>
              <p className="text-xs text-emerald-400/90 mt-1.5">
                Đã ghi nhớ tài khoản. Đang đưa bạn quay trở lại ứng dụng...
              </p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Ủy quyền chưa thành công</h2>
              <p className="text-xs text-red-400 mt-1.5 bg-red-950/40 p-3 rounded-xl border border-red-900/40">
                {errorMessage}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition"
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
