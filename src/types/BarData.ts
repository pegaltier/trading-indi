export interface BarData {
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export type BarWith<K extends keyof BarData> = Required<Pick<BarData, K>>;
