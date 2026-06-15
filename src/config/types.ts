export type AgenticE2EConfig = {
  framework?: "nextjs";
  baseUrl?: string;
  testDir?: string;
  generatedDir?: string;
  reportsDir?: string;
  healDir?: string;
  runner?: "playwright";
  agent?: {
    mode?: "review-before-write" | "auto";
  };
  check?: {
    heal?: boolean;
  };
};

export type ResolvedAgenticE2EConfig = {
  framework: "nextjs";
  baseUrl: string;
  testDir: string;
  generatedDir: string;
  reportsDir: string;
  healDir: string;
  runner: "playwright";
  agent: {
    mode: "review-before-write" | "auto";
  };
  check: {
    heal: boolean;
  };
};