/// <reference types="vite/client" />

declare module '@mujoco/mujoco' {
  export type MainModule = any;
  export default function loadMujoco(options?: {
    locateFile?: (fileName: string, scriptDirectory?: string) => string;
  }): Promise<MainModule>;
}

declare module '@vitejs/plugin-react' {
  import type { PluginOption } from 'vite';
  export default function react(...args: any[]): PluginOption;
}
