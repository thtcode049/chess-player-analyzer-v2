import { Chess } from "chess.js";

export interface MoveNode {
  id: string;
  san: string;
  fen: string;
  ply: number; // 1-based ply index (1 = White move 1, 2 = Black move 1, 3 = White move 2...)
  moveNumber: number; // Math.floor((ply - 1) / 2) + 1
  isWhite: boolean; // ply % 2 === 1
  parentId: string | null;
  children: MoveNode[]; // children[0] is the main branch continuation; children[1..] are variations!
}

export interface MoveTreeState {
  rootNodes: MoveNode[]; // Moves from starting position (rootNodes[0] is main line move 1; rootNodes[1..] are alternative move 1s)
  activeNodeId: string | null; // Currently active/selected move node (null = starting position)
  startFen: string;
}

const DEFAULT_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

let idCounter = 0;
function generateNodeId(ply: number, san: string): string {
  idCounter += 1;
  return `node_${ply}_${san.replace(/[^a-zA-Z0-9]/g, "")}_${Date.now()}_${idCounter}`;
}

/**
 * Recursively find a node by its ID in the tree.
 */
export function findNodeById(nodes: MoveNode[], id: string): MoveNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Recursively find the parent of a node with target ID.
 */
export function findParentOfNode(rootNodes: MoveNode[], targetId: string): MoveNode | null {
  for (const node of rootNodes) {
    if (node.children.some((c) => c.id === targetId)) {
      return node;
    }
    const found = findParentOfNode(node.children, targetId);
    if (found) return found;
  }
  return null;
}

/**
 * Builds a MoveTree from an array of SAN moves (e.g. from PGN or initial load).
 */
export function createMoveTreeFromMoves(
  moves: string[] = [],
  startFen: string = DEFAULT_START_FEN
): MoveTreeState {
  const rootNodes: MoveNode[] = [];
  let parent: MoveNode | null = null;
  let lastNode: MoveNode | null = null;

  try {
    const chess = new Chess(startFen);
    for (let i = 0; i < moves.length; i++) {
      const san = moves[i];
      const res = chess.move(san);
      if (!res) break;
      const fen = chess.fen();
      const ply = i + 1;
      const node: MoveNode = {
        id: generateNodeId(ply, san),
        san: res.san || san,
        fen,
        ply,
        moveNumber: Math.floor((ply - 1) / 2) + 1,
        isWhite: ply % 2 === 1,
        parentId: parent ? parent.id : null,
        children: [],
      };

      if (parent) {
        parent.children.push(node);
      } else {
        rootNodes.push(node);
      }
      parent = node;
      lastNode = node;
    }
  } catch (err) {
    console.warn("Failed to create MoveTree from moves:", err);
  }

  return {
    rootNodes,
    activeNodeId: lastNode ? lastNode.id : null,
    startFen,
  };
}

/**
 * Gets the main line path from root to the end of children[0].
 */
export function getMainLine(tree: MoveTreeState): MoveNode[] {
  const path: MoveNode[] = [];
  if (!tree.rootNodes || tree.rootNodes.length === 0) return path;

  let curr: MoveNode | undefined = tree.rootNodes[0];
  while (curr) {
    path.push(curr);
    curr = curr.children && curr.children.length > 0 ? curr.children[0] : undefined;
  }
  return path;
}

/**
 * Gets the active line: path from root through the active node to the end of that branch.
 */
export function getActivePath(tree: MoveTreeState): MoveNode[] {
  if (!tree.activeNodeId) {
    return getMainLine(tree);
  }

  const targetNode = findNodeById(tree.rootNodes, tree.activeNodeId);
  if (!targetNode) {
    return getMainLine(tree);
  }

  // 1. Ancestors from root to targetNode
  const pathToTarget: MoveNode[] = [];
  let curr: MoveNode | null = targetNode;
  while (curr) {
    pathToTarget.unshift(curr);
    curr = curr.parentId ? findNodeById(tree.rootNodes, curr.parentId) : null;
  }

  // 2. Descendants from targetNode along children[0]
  let walker: MoveNode = targetNode;
  while (walker.children && walker.children.length > 0) {
    walker = walker.children[0];
    pathToTarget.push(walker);
  }

  return pathToTarget;
}

/**
 * Adds a new move to the tree from the current active position.
 * If the move already exists, it switches to it.
 * If another move already exists at this branch point, it creates a VARIATION (biến phụ)!
 */
export function addMoveToTree(
  tree: MoveTreeState,
  san: string,
  newFen: string
): { tree: MoveTreeState; newNode: MoveNode; isNewVariation: boolean } {
  // Deep clone tree root nodes to maintain immutability
  const cloneRootNodes = JSON.parse(JSON.stringify(tree.rootNodes)) as MoveNode[];

  if (!tree.activeNodeId) {
    // We are at the root (starting position)
    const existingIndex = cloneRootNodes.findIndex((n) => n.san === san);
    if (existingIndex !== -1) {
      return {
        tree: { ...tree, rootNodes: cloneRootNodes, activeNodeId: cloneRootNodes[existingIndex].id },
        newNode: cloneRootNodes[existingIndex],
        isNewVariation: false,
      };
    }

    const newNode: MoveNode = {
      id: generateNodeId(1, san),
      san,
      fen: newFen,
      ply: 1,
      moveNumber: 1,
      isWhite: true,
      parentId: null,
      children: [],
    };

    cloneRootNodes.push(newNode);
    const isNewVariation = cloneRootNodes.length > 1;

    return {
      tree: {
        ...tree,
        rootNodes: cloneRootNodes,
        activeNodeId: newNode.id,
      },
      newNode,
      isNewVariation,
    };
  }

  const activeNode = findNodeById(cloneRootNodes, tree.activeNodeId);
  if (!activeNode) {
    // Fallback if node not found
    return {
      tree,
      newNode: {
        id: generateNodeId(1, san),
        san,
        fen: newFen,
        ply: 1,
        moveNumber: 1,
        isWhite: true,
        parentId: null,
        children: [],
      },
      isNewVariation: false,
    };
  }

  // Check if activeNode already has a child with this SAN
  const existingChild = activeNode.children.find((c) => c.san === san);
  if (existingChild) {
    return {
      tree: {
        ...tree,
        rootNodes: cloneRootNodes,
        activeNodeId: existingChild.id,
      },
      newNode: existingChild,
      isNewVariation: false,
    };
  }

  const nextPly = activeNode.ply + 1;
  const newNode: MoveNode = {
    id: generateNodeId(nextPly, san),
    san,
    fen: newFen,
    ply: nextPly,
    moveNumber: Math.floor((nextPly - 1) / 2) + 1,
    isWhite: nextPly % 2 === 1,
    parentId: activeNode.id,
    children: [],
  };

  const isNewVariation = activeNode.children.length > 0;
  activeNode.children.push(newNode);

  return {
    tree: {
      ...tree,
      rootNodes: cloneRootNodes,
      activeNodeId: newNode.id,
    },
    newNode,
    isNewVariation,
  };
}

/**
 * Promotes a variation to become the main line (Trở thành biến chính).
 * Swaps this variation to index 0, pushing the former main line to index 1.
 * Also promotes all ancestors up to the root if needed.
 */
export function promoteVariationToMainLine(tree: MoveTreeState, targetNodeId: string): MoveTreeState {
  const cloneRootNodes = JSON.parse(JSON.stringify(tree.rootNodes)) as MoveNode[];
  const targetNode = findNodeById(cloneRootNodes, targetNodeId);
  if (!targetNode) return tree;

  let currentId: string = targetNodeId;

  while (currentId) {
    const parent = findParentOfNode(cloneRootNodes, currentId);
    if (!parent) {
      // Node is in rootNodes
      const idx = cloneRootNodes.findIndex((n) => n.id === currentId);
      if (idx > 0) {
        const [promoted] = cloneRootNodes.splice(idx, 1);
        cloneRootNodes.unshift(promoted);
      }
      break;
    } else {
      const idx = parent.children.findIndex((c) => c.id === currentId);
      if (idx > 0) {
        const [promoted] = parent.children.splice(idx, 1);
        parent.children.unshift(promoted);
      }
      currentId = parent.id;
    }
  }

  return {
    ...tree,
    rootNodes: cloneRootNodes,
    activeNodeId: targetNodeId,
  };
}

/**
 * Deletes a move and all subsequent moves in its branch (Xoá từ đây).
 */
export function deleteMoveFromHere(tree: MoveTreeState, targetNodeId: string): MoveTreeState {
  const cloneRootNodes = JSON.parse(JSON.stringify(tree.rootNodes)) as MoveNode[];
  const parent = findParentOfNode(cloneRootNodes, targetNodeId);

  // Check if active node is inside the subtree being deleted
  const isTargetOrDescendant = (node: MoveNode, id: string): boolean => {
    if (node.id === id) return true;
    return node.children.some((c) => isTargetOrDescendant(c, id));
  };

  const targetNode = findNodeById(cloneRootNodes, targetNodeId);
  const activeIsDeleted = targetNode ? isTargetOrDescendant(targetNode, tree.activeNodeId || "") : false;

  let nextActiveId = tree.activeNodeId;

  if (!parent) {
    // In rootNodes
    const idx = cloneRootNodes.findIndex((n) => n.id === targetNodeId);
    if (idx !== -1) {
      cloneRootNodes.splice(idx, 1);
      if (activeIsDeleted) {
        nextActiveId = cloneRootNodes.length > 0 ? cloneRootNodes[0].id : null;
      }
    }
  } else {
    const idx = parent.children.findIndex((c) => c.id === targetNodeId);
    if (idx !== -1) {
      parent.children.splice(idx, 1);
      if (activeIsDeleted) {
        nextActiveId = parent.id;
      }
    }
  }

  return {
    ...tree,
    rootNodes: cloneRootNodes,
    activeNodeId: nextActiveId,
  };
}

/**
 * Exports a variation from a node to standard PGN notation (Sao chép biến PGN).
 */
export function exportVariationPgn(tree: MoveTreeState, startNodeId: string): string {
  const startNode = findNodeById(tree.rootNodes, startNodeId);
  if (!startNode) return "";

  const moves: MoveNode[] = [];
  let curr: MoveNode | undefined = startNode;
  while (curr) {
    moves.push(curr);
    curr = curr.children && curr.children.length > 0 ? curr.children[0] : undefined;
  }

  if (moves.length === 0) return "";

  const parts: string[] = [];
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (m.isWhite) {
      parts.push(`${m.moveNumber}. ${m.san}`);
    } else {
      if (i === 0) {
        parts.push(`${m.moveNumber}... ${m.san}`);
      } else {
        parts.push(m.san);
      }
    }
  }

  return parts.join(" ");
}

/**
 * Checks if a given node is currently a variation (i.e. not the main line).
 */
export function isNodeVariation(tree: MoveTreeState, nodeId: string): boolean {
  const parent = findParentOfNode(tree.rootNodes, nodeId);
  if (!parent) {
    const idx = tree.rootNodes.findIndex((n) => n.id === nodeId);
    return idx > 0;
  }
  const idx = parent.children.findIndex((c) => c.id === nodeId);
  if (idx > 0) return true;

  // Check if any ancestor is a variation
  return isNodeVariation(tree, parent.id);
}
