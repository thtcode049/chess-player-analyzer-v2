"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  Upload,
  Swords,
  Layers,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  MoreHorizontal,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Info,
} from "lucide-react";
import { Player } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import { useProfileWorkspaceStore, ColorRole } from "@/lib/stores/profileWorkspaceStore";

export default function ProfileHub() {
  const {
    players,
    loadingPlayers,
    refreshPlayersList,
    selectSingleProfile,
    multiProfiles,
    setMultiProfileRole,
    clearMultiProfiles,
    openMatchupBoard,
    isMatchupLoading,
    cachedProfiles,
  } = useProfileWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [hubMode, setHubMode] = useState<"single" | "multi">("single");

  // Modal actions: "create" | "edit" | "delete" | "none"
  const [modalAction, setModalAction] = useState<"none" | "create" | "edit" | "delete">("none");

  // Create Form State
  const [createName, setCreateName] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createFideId, setCreateFideId] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit Form State
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editFideId, setEditFideId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete State
  const [deletingPlayer, setDeletingPlayer] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast notice
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 4000);
  };

  // Switch to multi-mode automatically if multiProfiles has selections
  useEffect(() => {
    if (multiProfiles.length > 0) {
      setHubMode("multi");
    }
  }, [multiProfiles.length]);

  // Filter players by search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players;
    const q = searchQuery.toLowerCase().trim();
    return players.filter((p) => {
      const matchName = (p.canonical_name || "").toLowerCase().includes(q);
      const matchTitle = (p.title || "").toLowerCase().includes(q);
      const matchFide = p.fide_id ? String(p.fide_id).includes(q) : false;
      const matchNotes = (p.notes || "").toLowerCase().includes(q);
      return matchName || matchTitle || matchFide || matchNotes;
    });
  }, [players, searchQuery]);

  // Matchup summary counts
  const whiteAssigned = useMemo(
    () => multiProfiles.filter((m) => m.role === "white" || m.role === "both"),
    [multiProfiles]
  );
  const blackAssigned = useMemo(
    () => multiProfiles.filter((m) => m.role === "black" || m.role === "both"),
    [multiProfiles]
  );

  // Handlers for Create
  const handleOpenCreate = () => {
    setCreateName("");
    setCreateTitle("");
    setCreateFideId("");
    setCreateNotes("");
    setModalAction("create");
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const newP = await apiClient.createPlayer({
        canonical_name: createName.trim(),
        title: createTitle.trim() || undefined,
        fide_id: createFideId.trim() ? parseInt(createFideId.trim(), 10) : undefined,
        notes: createNotes.trim() || undefined,
      });
      await refreshPlayersList();
      setModalAction("none");
      showToast(`Đã tạo hồ sơ "${newP.canonical_name}" thành công`);
    } catch (err: any) {
      showToast(err.message || "Lỗi tạo hồ sơ kỳ thủ", "error");
    } finally {
      setCreating(false);
    }
  };

  // Handlers for Edit
  const handleOpenEdit = (p: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
    setEditingPlayer(p);
    setEditName(p.canonical_name);
    setEditTitle(p.title || "");
    setEditFideId(p.fide_id ? String(p.fide_id) : "");
    setEditNotes(p.notes || "");
    setModalAction("edit");
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer || !editName.trim()) return;
    setUpdating(true);
    try {
      const updated = await apiClient.updatePlayer(editingPlayer.id, {
        canonical_name: editName.trim(),
        title: editTitle.trim() || undefined,
        fide_id: editFideId.trim() ? parseInt(editFideId.trim(), 10) : undefined,
        notes: editNotes.trim() || undefined,
      });
      await refreshPlayersList();
      setModalAction("none");
      showToast(`Đã cập nhật hồ sơ "${updated.canonical_name}"`);
    } catch (err: any) {
      showToast(err.message || "Lỗi cập nhật hồ sơ", "error");
    } finally {
      setUpdating(false);
    }
  };

  // Handlers for Delete
  const handleOpenDelete = (p: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
    setDeletingPlayer(p);
    setModalAction("delete");
  };

  const handleConfirmDelete = async () => {
    if (!deletingPlayer) return;
    setDeleting(true);
    try {
      await apiClient.deletePlayer(deletingPlayer.id);
      await refreshPlayersList();
      setModalAction("none");
      showToast(`Đã xóa hồ sơ kỳ thủ thành công`);
    } catch (err: any) {
      showToast(err.message || "Lỗi xóa hồ sơ", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-[calc(100vw_-_2rem)] sm:max-w-6xl mx-auto px-4 sm:px-6 space-y-6 sm:space-y-8 animate-fade-in pb-28">
      {/* Toast Notice */}
      {notice && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-surface shadow-lg transition-all animate-slide-in ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          )}
          <span className="text-xs font-semibold">{notice.message}</span>
          <button
            onClick={() => setNotice(null)}
            className="ml-2 text-muted-foreground hover:text-foreground p-0.5 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative pb-1">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="w-full min-w-0 space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold tracking-wide">
              <Users className="w-3.5 h-3.5" />
              <span>Thư viện hồ sơ kỳ thủ</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Quản lý & Không gian Phân tích
            </h1>
            <p className="w-full break-words text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Chọn một kỳ thủ để phân tích chuyên sâu dữ liệu ván đấu và hệ thống khai cuộc, hoặc bật chế độ
              ghép đôi nhiều hồ sơ để chuẩn bị phương án đối đầu Trắng vs Đen.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex w-full sm:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={handleOpenCreate}
              className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-3 py-1.5 rounded-control bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>+ Tạo Hồ Sơ</span>
            </button>
            <Link
              href="/import"
              className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-3.5 py-1.5 rounded-control bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
            >
              <Upload className="w-4 h-4" />
              <span>+ Nạp Ván Mới (PGN/Lichess)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Control Bar: Mode Toggle + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-1">
        {/* Mode Switcher */}
        <div className="flex w-full sm:w-auto flex-col sm:flex-row items-stretch gap-1 p-0.5 rounded-control bg-muted self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setHubMode("single");
            }}
            className={`inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-semibold transition-colors ${
              hubMode === "single"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-500" />
            <span>Phân tích 1 kỳ thủ (Single)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setHubMode("multi");
            }}
            className={`inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-semibold transition-colors ${
              hubMode === "multi"
                ? "bg-emerald-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Ghép Trắng/Đen (Matchup Mode)</span>
            {multiProfiles.length > 0 && (
              <span className="px-1.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                {multiProfiles.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full min-w-0 flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo tên, danh hiệu..."
            className="w-full bg-background border border-border rounded pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Players Grid */}
      {loadingPlayers ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm text-muted-foreground font-medium">Đang tải danh sách hồ sơ kỳ thủ...</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 text-center rounded-surface border border-dashed border-border bg-card space-y-3">
          <div className="w-12 h-12 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="font-bold text-base text-foreground">
              {searchQuery ? "Không tìm thấy kỳ thủ phù hợp" : "Chưa có hồ sơ kỳ thủ nào"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {searchQuery
                ? `Không có kết quả nào khớp với "${searchQuery}". Hãy thử từ khóa khác.`
                : "Bắt đầu bằng cách nạp ván cờ từ Lichess, Chess.com hoặc tệp PGN để tự động tạo hồ sơ."}
            </p>
          </div>
          <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 pt-2">
            <Link
              href="/import"
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-4 py-2 rounded-control bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Nạp Ván Đấu Ngay</span>
            </Link>
            <button
              onClick={handleOpenCreate}
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-4 py-2 rounded-control border border-border hover:bg-muted text-foreground text-xs font-semibold transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Tạo Hồ Sơ Thủ Công</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredPlayers.map((player) => {
            const isCached = !!cachedProfiles[player.id];
            const cachedData = cachedProfiles[player.id];
            const totalGames = cachedData ? cachedData.games.length : player.total_games || 0;

            // Check multi-profile role
            const multiItem = multiProfiles.find((m) => m.player.id === player.id);
            const activeRole = multiItem ? multiItem.role : null;

            return (
              <div
                key={player.id}
                onClick={() => {
                  if (hubMode === "single") {
                    selectSingleProfile(player.id, "profile");
                  }
                }}
                className={`group relative flex flex-col justify-between p-4 rounded-surface bg-card shadow-xs transition-colors ${
                  hubMode === "single"
                    ? "cursor-pointer hover:shadow-sm"
                    : activeRole
                    ? "bg-emerald-50/70 ring-1 ring-emerald-500 shadow-none"
                    : "hover:bg-muted/30"
                }`}
              >
                {/* Top Row: Avatar & Badges & Action Buttons */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded bg-muted text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {player.canonical_name ? player.canonical_name[0].toUpperCase() : "P"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground truncate group-hover:text-emerald-700 transition-colors">
                            {player.canonical_name}
                          </h3>
                          {player.title && (
                            <span className="px-2 py-0.5 rounded-tag bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 shrink-0">
                              {player.title}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {player.fide_id ? `FIDE ID: ${player.fide_id}` : "Hồ sơ kỳ thủ"}
                        </p>
                      </div>
                    </div>

                    {/* Card Actions (Edit/Delete) */}
                    <details
                      className="relative shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          event.currentTarget.open = false;
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.currentTarget.open = false;
                          event.currentTarget.querySelector("summary")?.focus();
                        }
                      }}
                    >
                      <summary
                        className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 [&::-webkit-details-marker]:hidden"
                        aria-label={`Thao tác với hồ sơ ${player.canonical_name}`}
                        title="Thao tác hồ sơ"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </summary>
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-36 rounded-surface bg-card p-1 shadow-md">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(player, e)}
                          className="flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          Chỉnh sửa hồ sơ
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleOpenDelete(player, e)}
                          className="flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-xs text-rose-700 transition-colors hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa hồ sơ
                        </button>
                      </div>
                    </details>
                  </div>

                  {/* Compact profile metadata */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="px-2 py-0.5 rounded-tag bg-muted/70 text-foreground text-xs font-semibold font-mono tabular-nums">
                      {totalGames} ván đấu
                    </span>
                    {isCached && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-tag bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Đã nạp bộ nhớ
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row / Interaction Mode Actions */}
                <div className="pt-3 mt-3 border-t border-border">
                  {hubMode === "single" ? (
                    <div className="flex items-center justify-between text-xs font-medium text-emerald-700">
                      <span>Mở phân tích</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    /* Multi-Profile Matchup Role Buttons */
                    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                        <span>Vai trò:</span>
                        {activeRole && (
                          <button
                            type="button"
                            onClick={() => setMultiProfileRole(player, null)}
                            className="text-[10px] text-rose-500 hover:underline"
                          >
                            Bỏ chọn
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setMultiProfileRole(player, activeRole === "white" ? null : "white")
                          }
                          className={`py-1 px-1 rounded text-[10px] font-medium transition flex items-center justify-center gap-1 border cursor-pointer ${
                            activeRole === "white"
                              ? "bg-slate-100 text-slate-900 border-slate-300 font-bold"
                              : "bg-muted text-muted-foreground border-border hover:text-foreground"
                          }`}
                        >
                          <span>⚪ Trắng</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMultiProfileRole(player, activeRole === "black" ? null : "black")
                          }
                          className={`py-1 px-1 rounded text-[10px] font-medium transition flex items-center justify-center gap-1 border cursor-pointer ${
                            activeRole === "black"
                              ? "bg-slate-900 text-white border-slate-700 font-bold"
                              : "bg-muted text-muted-foreground border-border hover:text-foreground"
                          }`}
                        >
                          <span>⚫ Đen</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMultiProfileRole(player, activeRole === "both" ? null : "both")
                          }
                          className={`py-1 px-1 rounded text-[10px] font-medium transition flex items-center justify-center gap-1 border cursor-pointer ${
                            activeRole === "both"
                              ? "bg-emerald-600 text-white border-emerald-500 font-bold"
                              : "bg-muted text-muted-foreground border-border hover:text-foreground"
                          }`}
                        >
                          <span>⚪⚫ Cả hai</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Bar (Sticky at bottom in Multi-Profile Matchup Mode) */}
      {hubMode === "multi" && multiProfiles.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-4 rounded-md bg-slate-900 text-white border border-emerald-500/40 shadow-md">
            <div className="space-y-0.5 text-center sm:text-left min-w-0">
              <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">
                  Tổ hợp Matchup ({multiProfiles.length} kỳ thủ)
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate max-w-md">
                Đang chọn:{" "}
                <b className="text-white">
                  ⚪ Trắng ({whiteAssigned.map((m) => m.player.canonical_name).join(", ") || "Chưa chọn"})
                </b>{" "}
                vs{" "}
                <b className="text-white">
                  ⚫ Đen ({blackAssigned.map((m) => m.player.canonical_name).join(", ") || "Chưa chọn"})
                </b>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isMatchupLoading}
                onClick={clearMultiProfiles}
                className="px-2.5 py-1.5 rounded text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition"
              >
                Đặt lại
              </button>
              <button
                type="button"
                disabled={isMatchupLoading}
                onClick={openMatchupBoard}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition ${
                  isMatchupLoading
                    ? "bg-emerald-600/80 text-white cursor-wait"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                }`}
              >
                {isMatchupLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Đang nạp ván đấu & mở bàn cờ...</span>
                  </>
                ) : (
                  <>
                    <Swords className="w-3.5 h-3.5 text-white" />
                    <span>Mở Bàn Cờ & Cây Khai Cuộc</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Tạo Hồ Sơ */}
      {modalAction === "create" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setModalAction("none")}
        >
          <div
            className="w-full max-w-md bg-card rounded-surface p-5 shadow-lg space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-muted text-emerald-600">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Tạo Hồ Sơ Kỳ Thủ Mới</h3>
              </div>
              <button
                onClick={() => setModalAction("none")}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlayer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1 text-[11px]">
                  Tên Kỳ Thủ (Canonical Name) *
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="VD: Carlsen, Magnus hoặc nganbanghe"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-foreground mb-1 text-[11px]">
                    Danh Hiệu (Title)
                  </label>
                  <input
                    type="text"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="GM, IM, FM..."
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1 text-[11px]">
                    FIDE ID
                  </label>
                  <input
                    type="number"
                    value={createFideId}
                    onChange={(e) => setCreateFideId(e.target.value)}
                    placeholder="1503014"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1 text-[11px]">
                  Ghi Chú
                </label>
                <textarea
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  placeholder="Ghi chú sở trường, CLB, giải đấu..."
                  rows={2}
                  className="w-full bg-background border border-border rounded p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="pt-2.5 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAction("none")}
                  className="px-3 py-1.5 rounded border border-border text-foreground hover:bg-muted text-xs font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Lưu Hồ Sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog: Sửa Hồ Sơ */}
      {modalAction === "edit" && editingPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setModalAction("none")}
        >
          <div
            className="w-full max-w-md bg-card rounded-surface p-5 shadow-lg space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-muted text-primary">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Chỉnh Sửa Hồ Sơ Kỳ Thủ</h3>
              </div>
              <button
                onClick={() => setModalAction("none")}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePlayer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1 text-[11px]">
                  Tên Chính Thức (Canonical Name) *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-foreground mb-1 text-[11px]">
                    Danh Hiệu (Title)
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="GM, IM, FM..."
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1 text-[11px]">
                    FIDE ID
                  </label>
                  <input
                    type="number"
                    value={editFideId}
                    onChange={(e) => setEditFideId(e.target.value)}
                    placeholder="1503014"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1 text-[11px]">
                  Ghi Chú
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ghi chú sở trường, CLB, giải đấu..."
                  rows={2}
                  className="w-full bg-background border border-border rounded p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="pt-2.5 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAction("none")}
                  className="px-3 py-1.5 rounded border border-border text-foreground hover:bg-muted text-xs font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Cập Nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog: Xóa Hồ Sơ */}
      {modalAction === "delete" && deletingPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setModalAction("none")}
        >
          <div
            className="w-full max-w-md bg-card rounded-surface p-5 shadow-lg space-y-3.5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="p-2 rounded bg-rose-500/10">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Xác Nhận Xóa Hồ Sơ</h3>
                <p className="text-xs text-muted-foreground">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ kỳ thủ{" "}
              <b className="text-foreground">{deletingPlayer.canonical_name}</b> cùng toàn bộ ván đấu
              đã nhập vào hệ thống không?
            </p>

            <div className="pt-2.5 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAction("none")}
                className="px-3 py-1.5 rounded border border-border text-foreground hover:bg-muted text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
