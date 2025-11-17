import { type OperatorDoc } from "../types/OpDoc.js";

// ============================================================================
// Binary Arithmetic Operators
// ============================================================================

export class Add {
  onData(lhs: number, rhs: number): number {
    return lhs + rhs;
  }

  static readonly doc: OperatorDoc = {
    type: "Add",
    onDataParam: "lhs, rhs",
    output: "number",
  };
}

export class Sub {
  onData(lhs: number, rhs: number): number {
    return lhs - rhs;
  }

  static readonly doc: OperatorDoc = {
    type: "Sub",
    onDataParam: "lhs, rhs",
    output: "number",
  };
}

export class Mul {
  onData(lhs: number, rhs: number): number {
    return lhs * rhs;
  }

  static readonly doc: OperatorDoc = {
    type: "Mul",
    onDataParam: "lhs, rhs",
    output: "number",
  };
}

export class Div {
  onData(lhs: number, rhs: number): number {
    return lhs / rhs;
  }

  static readonly doc: OperatorDoc = {
    type: "Div",
    desc: "Division",
    onDataParam: "lhs, rhs",
    output: "number",
  };
}

export class Mod {
  onData(lhs: number, rhs: number): number {
    return lhs % rhs;
  }

  static readonly doc: OperatorDoc = {
    type: "Mod",
    desc: "Modulo",
    onDataParam: "lhs, rhs",
    output: "number",
  };
}

export class Pow {
  onData(base: number, exp: number): number {
    return base ** exp;
  }

  static readonly doc: OperatorDoc = {
    type: "Pow",
    onDataParam: "base, exp",
    output: "number",
  };
}

export class Min {
  onData(lhs: number, rhs: number): number {
    return Math.min(lhs, rhs);
  }

  static readonly doc: OperatorDoc = {
    type: "Min",
    onDataParam: "lhs, rhs",
    output: "number",
  };
}

export class Max {
  onData(lhs: number, rhs: number): number {
    return Math.max(lhs, rhs);
  }

  static readonly doc: OperatorDoc = {
    type: "Max",
    onDataParam: "lhs, rhs",
    output: "number",
  };
}

// ============================================================================
// Unary Math Operations
// ============================================================================

export class Negate {
  onData(x: number): number {
    return -x;
  }

  static readonly doc: OperatorDoc = {
    type: "Negate",
    onDataParam: "x",
    output: "number",
  };
}

export class Abs {
  onData(x: number): number {
    return Math.abs(x);
  }

  static readonly doc: OperatorDoc = {
    type: "Abs",
    onDataParam: "x",
    output: "number",
  };
}

export class Sign {
  onData(x: number): number {
    return Math.sign(x);
  }

  static readonly doc: OperatorDoc = {
    type: "Sign",
    onDataParam: "x",
    output: "-1, 0, 1",
  };
}

export class Floor {
  onData(x: number): number {
    return Math.floor(x);
  }

  static readonly doc: OperatorDoc = {
    type: "Floor",
    onDataParam: "x",
    output: "number",
  };
}

export class Ceil {
  onData(x: number): number {
    return Math.ceil(x);
  }

  static readonly doc: OperatorDoc = {
    type: "Ceil",
    onDataParam: "x: number",
    output: "number",
  };
}

export class Round {
  onData(x: number): number {
    return Math.round(x);
  }

  static readonly doc: OperatorDoc = {
    type: "Round",
    onDataParam: "x",
    output: "number",
  };
}

export class Sqrt {
  onData(x: number): number {
    return Math.sqrt(x);
  }

  static readonly doc: OperatorDoc = {
    type: "Sqrt",
    onDataParam: "x",
    output: "number",
  };
}

export class Log {
  onData(x: number): number {
    return Math.log(x);
  }

  static readonly doc: OperatorDoc = {
    type: "Log",
    desc: "Natural logarithm",
    onDataParam: "x",
    output: "number",
  };
}

export class Exp {
  onData(x: number): number {
    return Math.exp(x);
  }

  static readonly doc: OperatorDoc = {
    type: "Exp",
    onDataParam: "x",
    output: "number",
  };
}

export class Log1p {
  onData(x: number): number {
    return Math.log1p(x);
  }

  static readonly doc: OperatorDoc = {
    type: "Log1p",
    onDataParam: "x",
    output: "number",
  };
}

export class Expm1 {
  onData(x: number): number {
    return Math.expm1(x);
  }

  static readonly doc: OperatorDoc = {
    type: "Expm1",
    onDataParam: "x",
    output: "number",
  };
}

export class Reciprocal {
  onData(input: number): number {
    return 1 / input;
  }

  static readonly doc: OperatorDoc = {
    type: "Reciprocal",
    onDataParam: "x",
    output: "number",
  };
}

export class Clamp {
  onData(x: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, x));
  }

  static readonly doc: OperatorDoc = {
    type: "Clamp",
    onDataParam: "x, min, max",
    output: "number",
  };
}

export class Lerp {
  onData(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  static readonly doc: OperatorDoc = {
    type: "Lerp",
    onDataParam: "a, b, t",
    output: "number",
  };
}

// ============================================================================
// N-ary Arithmetic Operators
// ============================================================================

export class SumOf {
  onData(...inputs: number[]): number {
    let sum = 0;
    for (const x of inputs) sum += x;
    return sum;
  }

  static readonly doc: OperatorDoc = {
    type: "SumOf",
    onDataParam: "...inputs: number[]",
    output: "number",
  };
}

export class ProdOf {
  onData(...inputs: number[]): number {
    let prod = 1;
    for (const x of inputs) prod *= x;
    return prod;
  }

  static readonly doc: OperatorDoc = {
    type: "ProdOf",
    onDataParam: "...inputs: number[]",
    output: "number",
  };
}

export class AvgOf {
  onData(...inputs: number[]): number {
    if (inputs.length === 0) return 0;
    let sum = 0;
    for (const x of inputs) sum += x;
    return sum / inputs.length;
  }

  static readonly doc: OperatorDoc = {
    type: "AvgOf",
    onDataParam: "...inputs: number[]",
    output: "number",
  };
}

export class MinOf {
  onData(...inputs: number[]): number {
    return Math.min(...inputs);
  }

  static readonly doc: OperatorDoc = {
    type: "MinOf",
    onDataParam: "...inputs: number[]",
    output: "number",
  };
}

export class MaxOf {
  onData(...inputs: number[]): number {
    return Math.max(...inputs);
  }

  static readonly doc: OperatorDoc = {
    type: "MaxOf",
    onDataParam: "...inputs: number[]",
    output: "number",
  };
}

// ============================================================================
// Statistical / Distance
// ============================================================================

export class RelDist {
  onData(a: number, b: number): number {
    return Math.abs(a - b) / (Math.abs(b) + Number.EPSILON);
  }

  static readonly doc: OperatorDoc = {
    type: "RelDist",
    desc: "abs(a-b)/abs(b)",
    onDataParam: "a, b",
    output: "number",
  };
}
