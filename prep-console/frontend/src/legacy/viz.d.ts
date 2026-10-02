/* Loose types for the carried-over chart toolkit in viz.js. */
type Opts = Record<string, any>;
export declare const VIZ: Record<string, { html(): string; init?(el: HTMLElement): void }>;
export declare function vizHTML(key: string): string;
export declare function mountViz(root: HTMLElement): void;
export declare function fig(o: Opts): string;
export declare function tableOf(head: string[], rows: (string | number)[][]): string;
export declare function lineChart(o: Opts): string;
export declare function barsH(o: Opts): string;
export declare function barsV(o: Opts): string;
export declare function heat(o: Opts): string;
export declare function seqLegend(lo: string, hi: string, label?: string): string;
export declare function esc(s: unknown): string;
