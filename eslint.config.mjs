import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "Import from @/components/icons. Add a new Lucide icon there first.",
            },
            {
              name: "@heroicons/react",
              message: "Use @/components/icons (Lucide). Do not add another pack.",
            },
            {
              name: "react-icons",
              message: "Use @/components/icons (Lucide). Do not add another pack.",
            },
            {
              name: "@tabler/icons-react",
              message: "Use @/components/icons (Lucide). Do not add another pack.",
            },
            {
              name: "phosphor-react",
              message: "Use @/components/icons (Lucide). Do not add another pack.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/icons.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
