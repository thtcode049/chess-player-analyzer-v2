"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Chess } from "chess.js";
import { EngineEvaluation } from "@/lib/stockfish/engineWorker";
import { FigurineMove } from "./FigurineMove";
import {
  Check,
  Settings,
  Loader2,
  Cloud,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCopy,
  Trash2,
} from "lucide-react";
import {
  MoveTreeState,
  MoveNode,
  getMainLine,
  getActivePath,
  isNodeVariation,
  exportVariationPgn,
} from "@/lib/chess/moveTree";

interface MoveHistoryProps {
  moves: string[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
  currentFen?: string;
  evaluation?: EngineEvaluation | null;
  isThinking?: boolean;
  isEngineEnabled?: boolean;
  onToggleEngine?: () => void;
  multiPv?: number;
  onMultiPvChange?: (count: number) => void;
  embedded?: boolean;
  // MoveTree integration
  moveTree?: MoveTreeState;
  onSelectNode?: (nodeId: string) => void;
  onPromoteVariation?: (nodeId: string) => void;
  onDeleteFromHere?: (nodeId: string) => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  node: MoveNode;
  isVariation: boolean;
  title: string;
}

interface MovePairItem {
  number: number;
  white?: string;
  black?: string;
  whitePly?: number;
  blackPly?: number;
  whiteNode?: MoveNode;
  blackNode?: MoveNode;
  whiteVariations: MoveNode[][];
  blackVariations: MoveNode[][];
}

export default function MoveHistory({
  moves = [],
  currentPly = 0,
  onSelectPly,
  currentFen,
  evaluation = null,
  isThinking = false,
  isEngineEnabled = true,
  onToggleEngine,
  embedded = false,
  moveTree,
  onSelectNode,
  onPromoteVariation,
  onDeleteFromHere,
}: MoveHistoryProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [internalEngineEnabled, setInternalEngineEnabled] = useState(true);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Controlled or uncontrolled engine toggle
  const isEngineOn = onToggleEngine !== undefined ? isEngineEnabled : internalEngineEnabled;
  const handleToggle = () => {
    if (onToggleEngine) {
      onToggleEngine();
    } else {
      setInternalEngineEnabled((prev) => !prev);
    }
  };

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  // Auto-clear toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Auto-scroll strictly inside container only
  useEffect(() => {
    if (activeRef.current && listContainerRef.current) {
      const container = listContainerRef.current;
      const activeEl = activeRef.current;

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();

      if (activeRect.top < containerRect.top) {
        const diff = containerRect.top - activeRect.top + 8;
        container.scrollBy({ top: -diff, behavior: "smooth" });
      } else if (activeRect.bottom > containerRect.bottom) {
        const diff = activeRect.bottom - containerRect.bottom + 8;
        container.scrollBy({ top: diff, behavior: "smooth" });
      }
    }
  }, [currentPly, moveTree?.activeNodeId]);

  // Format Main Eval Score (e.g. +0.1, -1.4, #3)
  const scoreCp = evaluation?.score ?? 0;
  const isMate = evaluation?.isMate ?? false;
  let evalText = "—";
  let evalColor = "text-slate-900 dark:text-slate-100";

  if (isEngineOn && evaluation) {
    if (isMate) {
      const mateIn = evaluation.mateIn ?? 0;
      evalText = mateIn > 0 ? `#${mateIn}` : `#${mateIn}`;
      evalColor =
        mateIn > 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400";
    } else {
      const pawns = scoreCp / 100;
      if (pawns === 0) {
        evalText = "0.0";
      } else {
        evalText = pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
      }

      if (pawns >= 0.3) {
        evalColor = "text-emerald-600 dark:text-emerald-400";
      } else if (pawns <= -0.3) {
        evalColor = "text-slate-600 dark:text-slate-400";
      } else {
        evalColor = "text-slate-800 dark:text-slate-200";
      }
    }
  }

  // Handle right click on a move node
  const handleContextMenu = (e: React.MouseEvent, node: MoveNode) => {
    e.preventDefault();
    e.stopPropagation();

    const title = node.isWhite
      ? `${node.moveNumber}. ${node.san}`
      : `${node.moveNumber}... ${node.san}`;

    const isVar = moveTree ? isNodeVariation(moveTree, node.id) : false;

    // Boundary check so menu doesn't overflow screen
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 180);

    setContextMenu({
      isOpen: true,
      x,
      y,
      node,
      isVariation: isVar,
      title,
    });
  };

  const handlePromoteAction = () => {
    if (!contextMenu || !onPromoteVariation) return;
    onPromoteVariation(contextMenu.node.id);
    setContextMenu(null);
    setToastMessage(`Đã đưa ${contextMenu.title} thành biến chính`);
  };

  const handleCopyPgnAction = async () => {
    if (!contextMenu || !moveTree) return;
    const pgnText = exportVariationPgn(moveTree, contextMenu.node.id);
    if (pgnText) {
      try {
        await navigator.clipboard.writeText(pgnText);
        setToastMessage(`Đã sao chép: ${pgnText}`);
      } catch {
        setToastMessage("Không thể truy cập clipboard");
      }
    }
    setContextMenu(null);
  };

  const handleDeleteAction = () => {
    if (!contextMenu || !onDeleteFromHere) return;
    onDeleteFromHere(contextMenu.node.id);
    setContextMenu(null);
    setToastMessage(`Đã xoá nhánh từ ${contextMenu.title}`);
  };

  // Determine active path in MoveTree for navigation
  const activePath = useMemo(() => {
    if (!moveTree) return [];
    return getActivePath(moveTree);
  }, [moveTree]);

  // Step forward/back using Tree active path
  const handleTreeStep = (direction: -1 | 1 | "first" | "last") => {
    if (!moveTree || !onSelectNode) return;
    if (direction === "first") {
      onSelectPly(0);
      return;
    }
    if (direction === "last") {
      if (activePath.length > 0) {
        onSelectNode(activePath[activePath.length - 1].id);
      }
      return;
    }

    const currentIdx = activePath.findIndex((n) => n.id === moveTree.activeNodeId);
    if (direction === -1) {
      if (currentIdx <= 0) {
        onSelectPly(0);
      } else {
        onSelectNode(activePath[currentIdx - 1].id);
      }
    } else if (direction === 1) {
      if (currentIdx === -1 && activePath.length > 0) {
        onSelectNode(activePath[0].id);
      } else if (currentIdx >= 0 && currentIdx < activePath.length - 1) {
        onSelectNode(activePath[currentIdx + 1].id);
      }
    }
  };

  // Main line nodes from tree
  const mainLineNodes = useMemo(() => {
    if (!moveTree) return [];
    return getMainLine(moveTree);
  }, [moveTree]);

  // Group main line nodes into pairs for 3-column table
  const mainLinePairs = useMemo<MovePairItem[]>(() => {
    if (!moveTree) {
      // Fallback to linear moves
      const pairs: MovePairItem[] = [];
      for (let i = 0; i < moves.length; i += 2) {
        pairs.push({
          number: Math.floor(i / 2) + 1,
          white: moves[i],
          black: moves[i + 1],
          whitePly: i + 1,
          blackPly: moves[i + 1] ? i + 2 : undefined,
          whiteVariations: [],
          blackVariations: [],
        });
      }
      return pairs;
    }

    const pairs: MovePairItem[] = [];

    let currentNumber = 1;
    let i = 0;

    while (i < mainLineNodes.length) {
      const node = mainLineNodes[i];
      if (node.isWhite) {
        const whiteNode = node;
        let blackNode: MoveNode | undefined = undefined;
        if (i + 1 < mainLineNodes.length && !mainLineNodes[i + 1].isWhite) {
          blackNode = mainLineNodes[i + 1];
          i += 2;
        } else {
          i += 1;
        }

        // Check for variations branching off White's move:
        // That means parent of whiteNode has alternative children!
        const whiteVariations: MoveNode[][] = [];
        const whiteParent = whiteNode.parentId
          ? mainLineNodes.find((n) => n.id === whiteNode.parentId)
          : null;
        const whiteSiblingList = whiteParent ? whiteParent.children : moveTree.rootNodes;
        for (let v = 1; v < whiteSiblingList.length; v++) {
          const varStart = whiteSiblingList[v];
          const branch: MoveNode[] = [varStart];
          let walker: MoveNode = varStart;
          while (walker.children && walker.children.length > 0) {
            walker = walker.children[0];
            branch.push(walker);
          }
          whiteVariations.push(branch);
        }

        // Check for variations branching off Black's move:
        // That means whiteNode has alternative children!
        const blackVariations: MoveNode[][] = [];
        if (whiteNode.children && whiteNode.children.length > 1) {
          for (let v = 1; v < whiteNode.children.length; v++) {
            const varStart = whiteNode.children[v];
            const branch: MoveNode[] = [varStart];
            let walker: MoveNode = varStart;
            while (walker.children && walker.children.length > 0) {
              walker = walker.children[0];
              branch.push(walker);
            }
            blackVariations.push(branch);
          }
        }

        pairs.push({
          number: whiteNode.moveNumber,
          whiteNode,
          blackNode,
          whiteVariations,
          blackVariations,
        });
      } else {
        // Unexpected orphaned black move
        pairs.push({
          number: node.moveNumber,
          blackNode: node,
          whiteVariations: [],
          blackVariations: [],
        });
        i += 1;
      }
    }

    return pairs;
  }, [moveTree, mainLineNodes, moves]);

  return (
    <div
      className={
        embedded
          ? "flex flex-col h-full w-full overflow-hidden bg-transparent relative"
          : "flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm h-full relative"
      }
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg border border-slate-700/80 animate-in fade-in-50 slide-in-from-top-2 pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Right-Click Context Menu (Floating) */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1.5 min-w-[210px] text-xs animate-in fade-in-50 zoom-in-95 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3.5 py-1.5 font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 text-center text-sm">
            {contextMenu.title}
          </div>

          {/* Action 1: Trở thành biến chính (Only if currently a variation) */}
          {contextMenu.isVariation && onPromoteVariation && (
            <button
              type="button"
              onClick={handlePromoteAction}
              className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer font-medium transition"
            >
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
              <span>Trở thành biến chính</span>
            </button>
          )}

          {/* Action 2: Sao chép biến PGN */}
          <button
            type="button"
            onClick={handleCopyPgnAction}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer font-medium transition"
          >
            <ClipboardCopy className="w-4 h-4 text-slate-400" />
            <span>Sao chép biến PGN</span>
          </button>

          {/* Action 3: Xoá từ đây */}
          {onDeleteFromHere && (
            <button
              type="button"
              onClick={handleDeleteAction}
              className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer font-medium transition"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Xoá từ đây</span>
            </button>
          )}
        </div>
      )}

      {/* Top Engine & Eval Header */}
      <div className="px-3.5 py-2 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Engine On/Off Toggle Switch */}
            <button
              type="button"
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                isEngineOn ? "bg-emerald-600 shadow-xs" : "bg-slate-300 dark:bg-slate-700"
              }`}
              title={isEngineOn ? "Tắt tính toán Stockfish" : "Bật tính toán Stockfish"}
            >
              <span
                className={`inline-flex h-4 w-4 transform items-center justify-center rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                  isEngineOn ? "translate-x-6" : "translate-x-1"
                }`}
              >
                {isEngineOn ? (
                  <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                )}
              </span>
            </button>

            {/* Large Bold Evaluation Score */}
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black font-mono tracking-tight ${evalColor}`}>
                {evalText}
              </span>
            </div>

            {/* Engine Sub-info (SF 19 1MB NNUE + Depth) */}
            <div className="flex flex-col text-[11px] leading-tight">
              <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                <span>SF 19 1MB</span>
                <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                  NNUE
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1 py-0.2 rounded font-mono">
                  + Độ sâu {isEngineOn ? (evaluation?.depth ?? (isThinking ? "..." : 14)) : 0}
                </span>
                {evaluation?.isCloud ? (
                  <span
                    className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 rounded tracking-wide shadow-xs"
                    title="Đánh giá từ Cloud Eval độ sâu tuyệt đối (Lichess Master DB)"
                  >
                    <Cloud className="w-2.5 h-2.5 fill-emerald-500/30 text-emerald-600 dark:text-emerald-400" />
                    CLOUD
                  </span>
                ) : (
                  <span className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-1 py-0.2 rounded">
                    WASM
                  </span>
                )}
                {isThinking && (
                  <span title="Đang tính toán...">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action: Settings */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button
                onClick={() => setShowSettingsPopover((prev) => !prev)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition cursor-pointer"
                title="Thông tin Engine"
              >
                <Settings className="w-4 h-4" />
              </button>
              {showSettingsPopover && (
                <div className="absolute right-0 top-8 z-20 w-64 rounded-xl bg-slate-900 text-slate-100 p-3 text-[11px] shadow-xl border border-slate-700 space-y-2">
                  <div className="font-bold text-emerald-400">Stockfish 19 NNUE & Cloud Eval</div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Độ sâu đám mây (Cloud):</span>
                    <span className="font-bold text-emerald-400">Độ sâu 40 - 75+</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Động cơ WASM cục bộ:</span>
                    <span className="font-bold text-white">Stockfish 19 NNUE (1MB)</span>
                  </div>
                  <div className="text-slate-400 text-[10px] pt-1.5 border-t border-slate-800 leading-relaxed">
                    Tích hợp cấu trúc cây biến Lichess: Tự động phân nhánh biến phụ khi đi nước thay thế, hỗ trợ nâng biến chính, sao chép biến PGN và xoá biến qua chuột phải.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Move list container */}
      <div
        ref={listContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1 text-xs scroll-smooth"
      >
        {mainLinePairs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 font-sans">
            Chưa có nước đi nào
          </div>
        ) : (
          mainLinePairs.map((pair, idx) => {
            // Check if active
            const isWhiteActive = moveTree
              ? moveTree.activeNodeId === pair.whiteNode?.id
              : currentPly === pair.whitePly;

            const isBlackActive = moveTree
              ? moveTree.activeNodeId === pair.blackNode?.id
              : currentPly === pair.blackPly;

            const whiteSan = pair.whiteNode ? pair.whiteNode.san : pair.white || "";
            const blackSan = pair.blackNode ? pair.blackNode.san : pair.black || "";

            return (
              <div key={idx} className="space-y-1">
                {/* Main line 3-column row */}
                <div className="grid grid-cols-[34px_1fr_1fr] items-center gap-1.5 rounded-lg text-xs">
                  {/* Gutter: Move Number */}
                  <span className="text-center font-semibold text-slate-400 bg-slate-100/70 dark:bg-slate-800/70 rounded py-1 select-none text-[13px]">
                    {pair.number}
                  </span>

                  {/* White Move */}
                  <button
                    ref={isWhiteActive ? activeRef : undefined}
                    onClick={() => {
                      if (moveTree && pair.whiteNode && onSelectNode) {
                        onSelectNode(pair.whiteNode.id);
                      } else {
                        onSelectPly(pair.whitePly ?? 0);
                      }
                    }}
                    onContextMenu={(e) => {
                      if (pair.whiteNode) handleContextMenu(e, pair.whiteNode);
                    }}
                    className={`px-2.5 py-1.5 rounded text-left transition flex items-center justify-between cursor-pointer ${
                      isWhiteActive
                        ? "bg-sky-600 text-white shadow-xs font-normal"
                        : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-normal"
                    }`}
                  >
                    <span className="font-normal text-[15px]">
                      <FigurineMove san={whiteSan} />
                    </span>
                    {isWhiteActive && isEngineOn && evalText !== "—" && (
                      <span className="text-[11px] font-mono opacity-90 pl-1 font-bold">
                        {evalText}
                      </span>
                    )}
                  </button>

                  {/* Black Move */}
                  {blackSan ? (
                    <button
                      ref={isBlackActive ? activeRef : undefined}
                      onClick={() => {
                        if (moveTree && pair.blackNode && onSelectNode) {
                          onSelectNode(pair.blackNode.id);
                        } else {
                          onSelectPly(pair.blackPly ?? 0);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (pair.blackNode) handleContextMenu(e, pair.blackNode);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left transition flex items-center justify-between cursor-pointer ${
                        isBlackActive
                          ? "bg-sky-600 text-white shadow-xs font-normal"
                          : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-normal"
                      }`}
                    >
                      <span className="font-normal text-[15px]">
                        <FigurineMove san={blackSan} />
                      </span>
                      {isBlackActive && isEngineOn && evalText !== "—" && (
                        <span className="text-[11px] font-mono opacity-90 pl-1 font-bold">
                          {evalText}
                        </span>
                      )}
                    </button>
                  ) : (
                    <span />
                  )}
                </div>

                {/* White Variations (Biến phụ của nước Trắng) */}
                {pair.whiteVariations &&
                  pair.whiteVariations.map((varBranch: MoveNode[], vIdx: number) => {
                    const startNode = varBranch[0];
                    const isStartActive = moveTree?.activeNodeId === startNode.id;

                    return (
                      <div
                        key={`w-var-${vIdx}`}
                        className="ml-6 pl-2.5 py-1 border-l-2 border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10 rounded-r-lg flex flex-wrap items-center gap-1.5 text-xs"
                      >
                        {/* Orange Badge for Variation Start (matching Lichess Image 2) */}
                        <button
                          ref={isStartActive ? activeRef : undefined}
                          type="button"
                          onClick={() => onSelectNode && onSelectNode(startNode.id)}
                          onContextMenu={(e) => handleContextMenu(e, startNode)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[12px] shadow-xs cursor-pointer transition ${
                            isStartActive
                              ? "bg-sky-600 text-white"
                              : "bg-amber-600 hover:bg-amber-700 text-white"
                          }`}
                          title="Bấm chuột phải để tuỳ chọn biến (Đưa thành biến chính, sao chép, xoá)"
                        >
                          <span>{startNode.moveNumber}.</span>
                          <FigurineMove san={startNode.san} />
                          {isStartActive && isEngineOn && evalText !== "—" && (
                            <span className="text-[10px] font-mono opacity-90 pl-0.5">
                              {evalText}
                            </span>
                          )}
                        </button>

                        {/* Subsequent moves in this variation */}
                        {varBranch.slice(1).map((mNode: MoveNode) => {
                          const isActive = moveTree?.activeNodeId === mNode.id;
                          return (
                            <button
                              key={mNode.id}
                              ref={isActive ? activeRef : undefined}
                              type="button"
                              onClick={() => onSelectNode && onSelectNode(mNode.id)}
                              onContextMenu={(e) => handleContextMenu(e, mNode)}
                              className={`px-1.5 py-0.5 rounded text-[13px] font-normal transition cursor-pointer flex items-center gap-1 ${
                                isActive
                                  ? "bg-sky-600 text-white font-semibold"
                                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                              }`}
                            >
                              {mNode.isWhite && (
                                <span className="text-[11px] text-slate-400 font-semibold">
                                  {mNode.moveNumber}.
                                </span>
                              )}
                              <FigurineMove san={mNode.san} />
                              {isActive && isEngineOn && evalText !== "—" && (
                                <span className="text-[10px] font-mono opacity-90 pl-0.5">
                                  {evalText}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}

                {/* Black Variations (Biến phụ của nước Đen - matching Image 2 e.g. 2... b6) */}
                {pair.blackVariations &&
                  pair.blackVariations.map((varBranch: MoveNode[], vIdx: number) => {
                    const startNode = varBranch[0];
                    const isStartActive = moveTree?.activeNodeId === startNode.id;

                    return (
                      <div
                        key={`b-var-${vIdx}`}
                        className="ml-6 pl-2.5 py-1 border-l-2 border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10 rounded-r-lg flex flex-wrap items-center gap-1.5 text-xs"
                      >
                        {/* Orange Badge for Variation Start: e.g. 2... b6 */}
                        <button
                          ref={isStartActive ? activeRef : undefined}
                          type="button"
                          onClick={() => onSelectNode && onSelectNode(startNode.id)}
                          onContextMenu={(e) => handleContextMenu(e, startNode)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[12px] shadow-xs cursor-pointer transition ${
                            isStartActive
                              ? "bg-sky-600 text-white"
                              : "bg-amber-600 hover:bg-amber-700 text-white"
                          }`}
                          title="Bấm chuột phải để tuỳ chọn biến (Đưa thành biến chính, sao chép, xoá)"
                        >
                          <span>{startNode.moveNumber}...</span>
                          <FigurineMove san={startNode.san} />
                          {isStartActive && isEngineOn && evalText !== "—" && (
                            <span className="text-[10px] font-mono opacity-90 pl-0.5">
                              {evalText}
                            </span>
                          )}
                        </button>

                        {/* Subsequent moves in this variation */}
                        {varBranch.slice(1).map((mNode: MoveNode) => {
                          const isActive = moveTree?.activeNodeId === mNode.id;
                          return (
                            <button
                              key={mNode.id}
                              ref={isActive ? activeRef : undefined}
                              type="button"
                              onClick={() => onSelectNode && onSelectNode(mNode.id)}
                              onContextMenu={(e) => handleContextMenu(e, mNode)}
                              className={`px-1.5 py-0.5 rounded text-[13px] font-normal transition cursor-pointer flex items-center gap-1 ${
                                isActive
                                  ? "bg-sky-600 text-white font-semibold"
                                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                              }`}
                            >
                              {mNode.isWhite && (
                                <span className="text-[11px] text-slate-400 font-semibold">
                                  {mNode.moveNumber}.
                                </span>
                              )}
                              <FigurineMove san={mNode.san} />
                              {isActive && isEngineOn && evalText !== "—" && (
                                <span className="text-[10px] font-mono opacity-90 pl-0.5">
                                  {evalText}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>

      {/* Touch-Friendly Move Navigation Bar */}
      <div className="px-2.5 py-1.5 bg-slate-50/90 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-800 shrink-0 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => (moveTree ? handleTreeStep("first") : onSelectPly(0))}
            disabled={
              moveTree
                ? moveTree.activeNodeId === null || activePath.length === 0
                : currentPly === 0 || moves.length === 0
            }
            title="Nước đầu tiên (Phím Home)"
            className="h-8 w-8 sm:h-8 sm:w-8.5 rounded-lg flex items-center justify-center bg-white dark:bg-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-600/80 transition cursor-pointer active:scale-95"
          >
            <ChevronsLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            type="button"
            onClick={() => (moveTree ? handleTreeStep(-1) : onSelectPly(Math.max(0, currentPly - 1)))}
            disabled={
              moveTree
                ? moveTree.activeNodeId === null || activePath.length === 0
                : currentPly === 0 || moves.length === 0
            }
            title="Lùi 1 nước (Phím < hoặc ←)"
            className="h-8 w-9 sm:h-8 sm:w-10 rounded-lg flex items-center justify-center bg-white dark:bg-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-600/80 transition cursor-pointer active:scale-95"
          >
            <ChevronLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
          <button
            type="button"
            onClick={() => (moveTree ? handleTreeStep(1) : onSelectPly(Math.min(moves.length, currentPly + 1)))}
            disabled={
              moveTree
                ? activePath.length === 0 ||
                  moveTree.activeNodeId === activePath[activePath.length - 1]?.id
                : currentPly >= moves.length || moves.length === 0
            }
            title="Tiến 1 nước (Phím > hoặc →)"
            className="h-8 w-9 sm:h-8 sm:w-10 rounded-lg flex items-center justify-center bg-white dark:bg-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-600/80 transition cursor-pointer active:scale-95"
          >
            <ChevronRight className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
          <button
            type="button"
            onClick={() => (moveTree ? handleTreeStep("last") : onSelectPly(moves.length))}
            disabled={
              moveTree
                ? activePath.length === 0 ||
                  moveTree.activeNodeId === activePath[activePath.length - 1]?.id
                : currentPly >= moves.length || moves.length === 0
            }
            title="Nước cuối cùng (Phím End)"
            className="h-8 w-8 sm:h-8 sm:w-8.5 rounded-lg flex items-center justify-center bg-white dark:bg-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-600/80 transition cursor-pointer active:scale-95"
          >
            <ChevronsRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
        <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
          {moveTree ? `${activePath.length} nước` : `${moves.length} nước`}
        </div>
      </div>
    </div>
  );
}
