import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Windows에서 localhost가 ::1(IPv6)로만 풀려 127.0.0.1로 접근 안 되는 케이스 방지
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
