export type FlowTopoError =
  | { type: "cycle"; nodes: string[] }
  | { type: "unreachable"; nodes: string[] };

function detectCycle(succ: Map<string, string[]>): FlowTopoError[] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;

  const state = new Map<string, number>();
  for (const node of succ.keys()) {
    state.set(node, WHITE);
  }

  const cycles: string[][] = [];

  const dfs = (node: string, path: string[]): void => {
    state.set(node, GRAY);
    path.push(node);

    const neighbors = succ.get(node) || [];
    for (const neighbor of neighbors) {
      const neighborState = state.get(neighbor);
      if (neighborState === GRAY) {
        const cycleStart = path.indexOf(neighbor);
        const cyclePath = path.slice(cycleStart).concat(neighbor);
        cycles.push(cyclePath);
      } else if (neighborState === WHITE) {
        dfs(neighbor, path);
      }
    }

    path.pop();
    state.set(node, BLACK);
  };

  for (const node of succ.keys()) {
    if (state.get(node) === WHITE) {
      dfs(node, []);
    }
  }

  return cycles.map((nodes) => ({ type: "cycle", nodes }));
}

function detectUnreachable(
  root: string,
  succ: Map<string, string[]>
): FlowTopoError[] {
  const reachable = new Set<string>();
  const queue = [root];
  reachable.add(root);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const neighbors = succ.get(node) || [];
    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  const unreachable: string[] = [];
  for (const node of succ.keys()) {
    if (!reachable.has(node)) {
      unreachable.push(node);
    }
  }

  return unreachable.length > 0
    ? [{ type: "unreachable", nodes: unreachable }]
    : [];
}

export function validateAdjList(
  root: string,
  succ: Map<string, string[]>
): FlowTopoError[] {
  const errors: FlowTopoError[] = [];
  errors.push(...detectCycle(succ));
  errors.push(...detectUnreachable(root, succ));
  return errors;
}
