export type TunnelProvider = 'ngrok' | 'zrok';
export interface TunnelConfig {
    provider: TunnelProvider;
    zrokApiUrl?: string;
    zrokToken?: string;
}
export declare function startTunnel(port: number, config?: TunnelConfig): Promise<string>;
declare function startNgrokTunnel(port: number): Promise<string>;
export declare function stopTunnel(): Promise<void>;
export declare function getCurrentTunnelUrl(): string | null;
export { startNgrokTunnel, stopTunnel as stopNgrokTunnel };
//# sourceMappingURL=tunnel.d.ts.map