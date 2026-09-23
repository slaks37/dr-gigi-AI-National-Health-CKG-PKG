import nextPlugin from "@next/eslint-plugin-next";
import firebaseRulesPlugin from "@firebase/eslint-plugin-security-rules";

export default [
  {
    ignores: ["dist/**/*", ".next/**/*", "node_modules/**/*"]
  },
  nextPlugin.flatConfig.recommended,
  firebaseRulesPlugin.configs["flat/recommended"]
];
