import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

let __vendorpath;
const __ci_project_dir = process.env.CI_PROJECT_DIR;

if (__ci_project_dir !== undefined) {
  __vendorpath = path.resolve(
    __ci_project_dir,
    "dysleksi/dysleksi/static/vendor/js/",
  );
} else {
  const __dirname =
  __vendorpath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "vendor/js/",
  );
}

console.error("__vendorpath", __vendorpath);

export default defineConfig({
  resolve: {
    alias: {
      "@popperjs/core": path.resolve(__vendorpath, "popper/popper.esm.min.js"),
      "bootstrap": path.resolve(__vendorpath, "bootstrap/bootstrap.esm.min.js"),
    },
  },
});
