import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // `public/cesium` son los Workers de Cesium: bundles ya minificados que se
  // regeneran al actualizar la librería. Barrearlos solo produce avisos sobre
  // código que no escribimos (hoy, 20 `no-useless-escape` en dos chunks de
  // 16 000 columnas) y arreglarlos a mano se pierde en la siguiente copia.
  { ignores: ["dist", "public/cesium"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
