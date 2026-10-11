import { defineConfig } from '@playwright/test';
export default defineConfig({
  // A complete virtual-time WebGL flow can exceed 35 seconds on SwiftShader.
  // Individual UI expectations keep their own deadlines and value checks.
  testDir:'tests/browser',fullyParallel:false,workers:1,timeout:90000,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1366,height:1000},browserName:'chromium',headless:true,launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']},trace:'retain-on-failure'},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30000},
});
