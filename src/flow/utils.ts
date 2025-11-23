function resolvePath(state: Record<string, any>, path: string): any {
  if (!path) return undefined;

  const parts = path.split(".");
  let value = state[parts[0]!];

  for (let i = 1; i < parts.length && value !== undefined; i++) {
    value = value?.[parts[i]!];
  }

  return value;
}

export type MaybePromise<T> = T | Promise<T>;

export interface DagNode {
  readonly __isDagNode: true;
  readonly inputPath: string[];

  predSatisfied(state: Record<string, any>): MaybePromise<any>;
}

export interface Op {
  update(...args: any[]): MaybePromise<any>;
}

/** Wraps an operator for use in graph */
export class OpAdapter implements DagNode {
  readonly __isDagNode = true;
  readonly inputPath: string[];

  constructor(private op: Op, inputPath: string[]) {
    this.inputPath = inputPath;
  }

  predSatisfied(state: Record<string, any>): MaybePromise<any> {
    const args = this.inputPath.map((path) => resolvePath(state, path));
    return this.op.update(...args);
  }
}
