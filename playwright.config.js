const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test-results",
  use: {
    browserName: "chromium",
  },
  projects: [
    {
      name: "panel",
      testMatch: "panel.spec.js",
    },
    {
      name: "smoke",
      testMatch: "smoke.spec.js",
    },
    {
      name: "screenshot",
      testMatch: "screenshot.spec.js",
    },
  ],
});
