import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  environments: {
    ssr: {
      keepProcessEnv: true,
    },
  },
  test: {
    include: ["tests/**/*.{test,spec}.{js,ts}"],
    exclude: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}", "node_modules/**/*"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
      },
    },
    // Coverage disabled for Cloudflare Workers due to node:inspector compatibility issues
    // coverage: {
    //   provider: "v8",
    //   reporter: ["text", "json", "html"],
    //   include: ["src/**/*"],
    //   exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    // },
  },
});
