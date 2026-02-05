import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendHost = process.env.BACKEND_HOST ?? "0.0.0.0";
const backendPort = process.env.BACKEND_PORT ?? "8080";
const backendTarget = `http://${backendHost}:${backendPort}`;

const proxyPaths = [
  "/backend_configs",
  "/data",
  "/demo_generation",
  "/dynamic_rlhf",
  "/files",
  "/get_all",
  "/interactions",
  "/load_setup",
  "/projection",
  "/save_backend_config",
  "/save_setup",
  "/save_ui_config",
  "/ui_configs",
];

const proxy = Object.fromEntries(
  proxyPaths.map((path) => [
    path,
    {
      target: backendTarget,
      changeOrigin: false,
      proxyTimeout: 1000 * 60 * 5,
      timeout: 1000 * 60 * 5,
    },
  ]),
);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy,
  },
  preview: {
    port: 3000,
  },
});
