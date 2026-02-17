import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import type { RepoAnalysis, RepoFileMatch } from "./types.js";
import { detectSapPatterns } from "./sap-patterns.js";

/**
 * Scan a repository and extract signals (tech stack, SAP patterns, configs).
 */

const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  ".venv",
  "target",
]);

async function walk(root: string, dir: string, out: string[], maxFiles: number): Promise<void> {
  if (out.length >= maxFiles) return;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (out.length >= maxFiles) return;
    const p = join(dir, e.name);
    const rel = p.substring(root.length + 1).replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (DEFAULT_IGNORE_DIRS.has(e.name)) continue;
      await walk(root, p, out, maxFiles);
    } else if (e.isFile()) {
      out.push(rel);
    }
  }
}

function addMatch(matches: RepoFileMatch[], path: string, kind: string, hints?: string[]): void {
  matches.push({ path, kind, hints });
}

export async function scanRepository(params: { root: string; maxFiles?: number }): Promise<RepoAnalysis> {
  const root = params.root;
  const name = basename(root);
  const maxFiles = params.maxFiles ?? 4000;

  const files: string[] = [];
  await walk(root, root, files, maxFiles);

  const matches: RepoFileMatch[] = [];
  const notes: string[] = [];

  const detected = {
    languages: new Set<string>(),
    frameworks: new Set<string>(),
    runtimes: new Set<string>(),
    databases: new Set<string>(),
    sap: new Set<string>(),
    cicd: new Set<string>(),
  };

  const has = (suffix: string) => files.some((f) => f.toLowerCase().endsWith(suffix));

  if (has(".ts") || has(".tsx")) detected.languages.add("TypeScript");
  if (has(".js") || has(".jsx")) detected.languages.add("JavaScript");
  if (has(".py")) detected.languages.add("Python");
  if (has(".java")) detected.languages.add("Java");
  if (has(".cs")) detected.languages.add("C#");
  if (has(".go")) detected.languages.add("Go");

  if (files.includes("package.json")) {
    addMatch(matches, "package.json", "node:manifest");
    detected.runtimes.add("Node.js");
  }
  if (files.includes("pom.xml")) addMatch(matches, "pom.xml", "java:maven");
  if (files.includes("build.gradle") || files.includes("build.gradle.kts")) addMatch(matches, "build.gradle", "java:gradle");
  if (files.includes("requirements.txt") || files.includes("pyproject.toml")) addMatch(matches, "requirements.txt", "python:deps");

  // DB schemas
  for (const f of files) {
    const lf = f.toLowerCase();
    if (lf.endsWith(".sql")) addMatch(matches, f, "db:sql");
    if (lf.endsWith(".cds")) addMatch(matches, f, "sap:cds");
    if (lf.includes("prisma/schema.prisma")) {
      addMatch(matches, f, "db:prisma");
      detected.databases.add("Prisma");
    }
  }

  // CI/CD
  if (files.some((f) => f.startsWith(".github/workflows/"))) {
    detected.cicd.add("GitHub Actions");
    addMatch(matches, ".github/workflows", "cicd:github-actions");
  }
  if (files.includes("azure-pipelines.yml")) {
    detected.cicd.add("Azure Pipelines");
    addMatch(matches, "azure-pipelines.yml", "cicd:azure");
  }
  if (files.includes("Jenkinsfile")) {
    detected.cicd.add("Jenkins");
    addMatch(matches, "Jenkinsfile", "cicd:jenkins");
  }

  // Configs
  if (files.includes("docker-compose.yml") || files.includes("docker-compose.yaml")) addMatch(matches, "docker-compose.yml", "docker:compose");
  if (files.includes("Dockerfile")) addMatch(matches, "Dockerfile", "docker:file");
  if (files.includes("helm/Chart.yaml") || files.includes("Chart.yaml")) addMatch(matches, "Chart.yaml", "k8s:helm");

  // README
  let readme: string | undefined;
  const readmePath = files.find((f) => f.toLowerCase() === "readme.md");
  if (readmePath) {
    readme = await readFile(join(root, readmePath), "utf-8").catch(() => undefined);
    if (readme) addMatch(matches, readmePath, "docs:readme");
  }

  // package.json parsing
  let packageJson: any;
  if (files.includes("package.json")) {
    try {
      packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf-8"));
      const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
      if (deps.express) detected.frameworks.add("Express");
      if (deps.next) detected.frameworks.add("Next.js");
      if (deps.react) detected.frameworks.add("React");
      if (deps["@sap/cds"]) detected.sap.add("CAP");
      if (deps["@ui5/cli"] || deps["@sap/ux-ui5-tooling"]) detected.sap.add("UI5");
    } catch {
      notes.push("Failed to parse package.json");
    }
  }

  // SAP patterns (file-based)
  const sap = detectSapPatterns({ files });
  for (const s of sap.signals) detected.sap.add(s);
  for (const m of sap.matches) matches.push(m);
  if (sap.notes.length) notes.push(...sap.notes);

  // Databases hints
  if (files.some((f) => f.toLowerCase().includes("hana"))) detected.databases.add("SAP HANA");
  if (files.some((f) => f.toLowerCase().includes("xsuaa"))) detected.sap.add("XSUAA");

  // basic API detection
  if (files.some((f) => f.toLowerCase().includes("openapi") || f.toLowerCase().endsWith("swagger.yaml") || f.toLowerCase().endsWith("swagger.json"))) {
    addMatch(matches, "openapi", "api:openapi");
    notes.push("OpenAPI/Swagger artifacts detected");
  }

  // detect size
  try {
    const s = await stat(root);
    if (!s.isDirectory()) notes.push("Root is not a directory");
  } catch {
    // ignore
  }

  const analysis: RepoAnalysis = {
    root,
    name,
    detected: {
      languages: [...detected.languages],
      frameworks: [...detected.frameworks],
      runtimes: [...detected.runtimes],
      databases: [...detected.databases],
      sap: [...detected.sap],
      cicd: [...detected.cicd],
    },
    files: matches,
    readme,
    packageJson,
    notes,
  };

  return analysis;
}
