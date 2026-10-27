const { Chess } = require("chess.js");

// Load functions to test
let idCounter = 0;
function generateNodeId(ply, san) {
  idCounter++;
  return `node_${ply}_${san.replace(/[^a-zA-Z0-9]/g, "")}_${Date.now()}_${idCounter}`;
}

function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findParentOfNode(rootNodes, targetId) {
  for (const node of rootNodes) {
    if (node.children.some((c) => c.id === targetId)) {
      return node;
    }
    const found = findParentOfNode(node.children, targetId);
    if (found) return found;
  }
  return null;
}

function createMoveTreeFromMoves(moves = [], startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
  const rootNodes = [];
  let parent = null;
  let lastNode = null;
  const chess = new Chess(startFen);
  for (let i = 0; i < moves.length; i++) {
    const san = moves[i];
    const res = chess.move(san);
    if (!res) break;
    const ply = i + 1;
    const node = {
      id: generateNodeId(ply, san),
      san: res.san || san,
      fen: chess.fen(),
      ply,
      moveNumber: Math.floor((ply - 1) / 2) + 1,
      isWhite: ply % 2 === 1,
      parentId: parent ? parent.id : null,
      children: [],
    };
    if (parent) parent.children.push(node);
    else rootNodes.push(node);
    parent = node;
    lastNode = node;
  }
  return { rootNodes, activeNodeId: lastNode ? lastNode.id : null, startFen };
}

function getMainLine(tree) {
  const path = [];
  if (!tree.rootNodes || tree.rootNodes.length === 0) return path;
  let curr = tree.rootNodes[0];
  while (curr) {
    path.push(curr);
    curr = curr.children && curr.children.length > 0 ? curr.children[0] : undefined;
  }
  return path;
}

function getPathToNode(tree, targetId) {
  if (!targetId) return [];
  const target = findNodeById(tree.rootNodes, targetId);
  if (!target) return [];
  const path = [];
  let curr = target;
  while (curr) {
    path.unshift(curr);
    curr = curr.parentId ? findNodeById(tree.rootNodes, curr.parentId) : null;
  }
  return path;
}

function getActivePath(tree) {
  if (!tree.activeNodeId) {
    return getMainLine(tree);
  }
  const pathToTarget = getPathToNode(tree, tree.activeNodeId);
  if (pathToTarget.length === 0) return getMainLine(tree);

  const targetNode = pathToTarget[pathToTarget.length - 1];
  let walker = targetNode;
  while (walker.children && walker.children.length > 0) {
    walker = walker.children[0];
    pathToTarget.push(walker);
  }
  return pathToTarget;
}

function addMoveToTree(tree, san, newFen) {
  const cloneRootNodes = JSON.parse(JSON.stringify(tree.rootNodes));

  if (!tree.activeNodeId) {
    // Root position (ply 1, White move 1)
    const existingIndex = cloneRootNodes.findIndex((n) => n.san === san);
    if (existingIndex !== -1) {
      return {
        tree: { ...tree, rootNodes: cloneRootNodes, activeNodeId: cloneRootNodes[existingIndex].id },
        newNode: cloneRootNodes[existingIndex],
        isNewVariation: false,
      };
    }

    const newNode = {
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
    return {
      tree: { ...tree, rootNodes: cloneRootNodes, activeNodeId: newNode.id },
      newNode,
      isNewVariation: cloneRootNodes.length > 1,
    };
  }

  const activeNode = findNodeById(cloneRootNodes, tree.activeNodeId);
  if (!activeNode) {
    return { tree, newNode: null, isNewVariation: false };
  }

  const existingChild = activeNode.children.find((c) => c.san === san);
  if (existingChild) {
    return {
      tree: { ...tree, rootNodes: cloneRootNodes, activeNodeId: existingChild.id },
      newNode: existingChild,
      isNewVariation: false,
    };
  }

  const nextPly = activeNode.ply + 1;
  const newNode = {
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
    tree: { ...tree, rootNodes: cloneRootNodes, activeNodeId: newNode.id },
    newNode,
    isNewVariation,
  };
}

function promoteVariationToMainLine(tree, targetNodeId) {
  const cloneRootNodes = JSON.parse(JSON.stringify(tree.rootNodes));
  let currentId = targetNodeId;
  while (currentId) {
    const parent = findParentOfNode(cloneRootNodes, currentId);
    if (!parent) {
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
  return { ...tree, rootNodes: cloneRootNodes, activeNodeId: targetNodeId };
}

function deleteMoveFromHere(tree, targetNodeId) {
  const cloneRootNodes = JSON.parse(JSON.stringify(tree.rootNodes));
  const parent = findParentOfNode(cloneRootNodes, targetNodeId);
  let nextActiveId = tree.activeNodeId;

  const isTargetOrDescendant = (node, id) => {
    if (node.id === id) return true;
    return node.children.some((c) => isTargetOrDescendant(c, id));
  };
  const targetNode = findNodeById(cloneRootNodes, targetNodeId);
  const activeIsDeleted = targetNode ? isTargetOrDescendant(targetNode, tree.activeNodeId || "") : false;

  if (!parent) {
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

  return { ...tree, rootNodes: cloneRootNodes, activeNodeId: nextActiveId };
}

function exportVariationPgn(tree, startNodeId) {
  const startNode = findNodeById(tree.rootNodes, startNodeId);
  if (!startNode) return "";
  const moves = [];
  let curr = startNode;
  while (curr) {
    moves.push(curr);
    curr = curr.children && curr.children.length > 0 ? curr.children[0] : undefined;
  }
  const parts = [];
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

// ----------------- AUTOMATED TEST RUNNER -----------------
let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  } else {
    passedCount++;
    console.log(`  ✓ ${message}`);
  }
}

console.log("==================================================");
console.log("LICHESS MOVE TREE AUTOMATED VERIFICATION SUITE");
console.log("==================================================");

// TEST 1: Initial linear tree creation
console.log("\n[Test 1] Building initial tree from moves: 1. e4 e5 2. Nf3 Nc6");
let tree = createMoveTreeFromMoves(["e4", "e5", "Nf3", "Nc6"]);
assert(tree.rootNodes.length === 1, "Root nodes count should be 1");
assert(tree.rootNodes[0].san === "e4", "Root move should be e4");
assert(tree.rootNodes[0].ply === 1, "e4 ply should be 1");
assert(tree.rootNodes[0].moveNumber === 1, "e4 moveNumber should be 1");
assert(tree.rootNodes[0].isWhite === true, "e4 isWhite should be true");

const e5 = tree.rootNodes[0].children[0];
assert(e5.san === "e5", "e5 move should be child of e4");
assert(e5.ply === 2, "e5 ply should be 2");
assert(e5.moveNumber === 1, "e5 moveNumber should be 1");
assert(e5.isWhite === false, "e5 isWhite should be false");

const nf3 = e5.children[0];
assert(nf3.san === "Nf3", "Nf3 move should be child of e5");
assert(nf3.ply === 3, "Nf3 ply should be 3");
assert(nf3.moveNumber === 2, "Nf3 moveNumber should be 2");
assert(nf3.isWhite === true, "Nf3 isWhite should be true");

const nc6 = nf3.children[0];
assert(nc6.san === "Nc6", "Nc6 move should be child of Nf3");
assert(nc6.ply === 4, "Nc6 ply should be 4");
assert(nc6.moveNumber === 2, "Nc6 moveNumber should be 2");
assert(nc6.isWhite === false, "Nc6 isWhite should be false");

// TEST 2: Branching variation at Move 1 (Black: 1... b6 - Owen Defense, matching Lichess Image 2)
console.log("\n[Test 2] Branching variation at Move 1 Black (1... b6)");
const e4Node = tree.rootNodes[0];
tree.activeNodeId = e4Node.id; // User navigates to e4

const c1 = new Chess(e4Node.fen);
const mB6 = c1.move("b6");
const addB6 = addMoveToTree(tree, mB6.san, c1.fen());
tree = addB6.tree;

assert(addB6.isNewVariation === true, "b6 should be recognized as a new variation");
const updatedE4 = tree.rootNodes[0];
assert(updatedE4.children.length === 2, "e4 must have 2 children: [e5, b6]");
assert(updatedE4.children[0].san === "e5", "e4 child 0 is e5 (main line)");
assert(updatedE4.children[1].san === "b6", "e4 child 1 is b6 (variation)");

const b6Node = updatedE4.children[1];
assert(b6Node.ply === 2, "1... b6 ply must be 2");
assert(b6Node.moveNumber === 1, "1... b6 moveNumber must be 1 (NOT 2!)");
assert(b6Node.isWhite === false, "1... b6 isWhite must be false (Black move)");
assert(tree.activeNodeId === b6Node.id, "activeNodeId must now be b6Node.id");

// TEST 3: Appending move 2. g4 to the variation
console.log("\n[Test 3] Appending White move 2. g4 to variation 1... b6");
const c2 = new Chess(b6Node.fen);
const mG4 = c2.move("g4");
const addG4 = addMoveToTree(tree, mG4.san, c2.fen());
tree = addG4.tree;

assert(addG4.isNewVariation === false, "g4 is first child of b6, not alternative to another child");
const g4Node = addG4.newNode;
assert(g4Node.ply === 3, "2. g4 ply must be 3");
assert(g4Node.moveNumber === 2, "2. g4 moveNumber must be 2");
assert(g4Node.isWhite === true, "2. g4 isWhite must be true (White move)");
assert(tree.activeNodeId === g4Node.id, "activeNodeId must now be g4Node.id");

// Verify active path vs main line
const activePath = getActivePath(tree);
assert(activePath.map((n) => n.san).join(" ") === "e4 b6 g4", "Active path must be: e4 b6 g4");
const mainLine = getMainLine(tree);
assert(mainLine.map((n) => n.san).join(" ") === "e4 e5 Nf3 Nc6", "Main line must remain untouched: e4 e5 Nf3 Nc6");

// TEST 4: Re-selecting existing move (navigating to e5)
console.log("\n[Test 4] Re-selecting existing move e5 on board should NOT duplicate");
tree.activeNodeId = tree.rootNodes[0].id; // Navigate back to e4
const reAddE5 = addMoveToTree(tree, "e5", updatedE4.children[0].fen);
tree = reAddE5.tree;
assert(reAddE5.isNewVariation === false, "Re-playing e5 is not a new variation");
assert(tree.rootNodes[0].children.length === 2, "e4 children count must remain 2 (no duplicate)");
assert(tree.activeNodeId === updatedE4.children[0].id, "activeNodeId should switch to existing e5 node");

// TEST 5: Nested variation inside variation (at move 2 White, playing 2. d4 instead of 2. g4)
console.log("\n[Test 5] Nested variation inside variation: 1... b6 2. d4");
const b6InTree = tree.rootNodes[0].children[1];
tree.activeNodeId = b6InTree.id; // Navigate to b6
const c3 = new Chess(b6InTree.fen);
const mD4 = c3.move("d4");
const addD4 = addMoveToTree(tree, mD4.san, c3.fen());
tree = addD4.tree;

assert(addD4.isNewVariation === true, "d4 is a second child of b6 (nested variation)");
const b6Updated = tree.rootNodes[0].children[1];
assert(b6Updated.children.length === 2, "b6 now has 2 children: [g4, d4]");
assert(b6Updated.children[0].san === "g4", "child 0 is g4");
assert(b6Updated.children[1].san === "d4", "child 1 is d4 (nested variation)");

// TEST 6: PGN Export for variation
console.log("\n[Test 6] PGN Export for variation");
const pgnText = exportVariationPgn(tree, b6Updated.id);
console.log("  Exported PGN:", pgnText);
assert(pgnText === "1... b6 2. g4", "Variation PGN must be formatted as: '1... b6 2. g4'");

// TEST 7: Promoting variation to main line ("Trở thành biến chính")
console.log("\n[Test 7] Promoting variation 1... b6 to main line");
tree = promoteVariationToMainLine(tree, b6Updated.id);
const newMainLine = getMainLine(tree);
console.log("  New main line moves:", newMainLine.map((n) => n.san).join(" "));
assert(newMainLine[1].san === "b6", "Main line move 1... must now be b6");
assert(newMainLine[2].san === "g4", "Main line move 2. must now be g4");
assert(tree.rootNodes[0].children[1].san === "e5", "e5 must now be index 1 (variation)");

// TEST 8: Deleting move from here ("Xoá từ đây")
console.log("\n[Test 8] Deleting move e5 from here");
const e5Variation = tree.rootNodes[0].children[1];
tree = deleteMoveFromHere(tree, e5Variation.id);
assert(tree.rootNodes[0].children.length === 1, "e4 now only has 1 child (b6)");
assert(tree.rootNodes[0].children[0].san === "b6", "Remaining child is b6");

console.log("\n==================================================");
console.log(`ALL ${passedCount}/${totalCount} TESTS PASSED SUCCESSFULLY! (100% PASS RATE)`);
console.log("==================================================");
