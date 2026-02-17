import type { RepoFileMatch } from "./types.js";

/**
 * SAP pattern detection (file/path heuristics).
 */

export interface SapPatternResult {
  signals: string[];
  matches: RepoFileMatch[];
  notes: string[];
}

export function detectSapPatterns(params: { files: string[] }): SapPatternResult {
  const files = params.files.map((f) => f.replace(/\\/g, "/"));
  const signals = new Set<string>();
  const matches: RepoFileMatch[] = [];
  const notes: string[] = [];

  const has = (needle: string) => files.some((f) => f.toLowerCase().includes(needle.toLowerCase()));
  const add = (signal: string, path?: string, kind?: string) => {
    signals.add(signal);
    if (path) matches.push({ path, kind: kind ?? `sap:${signal.toLowerCase()}` });
  };

  // CAP
  if (files.some((f) => f.endsWith(".cds")) || has("srv/") || has("db/") || has("package.json")) {
    if (has("@sap/cds") || files.some((f) => f.includes(".cds"))) {
      add("CAP");
      const cds = files.find((f) => f.endsWith(".cds"));
      if (cds) add("CAP", cds, "sap:cds");
    }
  }

  // ABAP
  if (has(".abap") || has("src/abap") || has("abap/")) {
    add("ABAP");
  }

  // BTP / Cloud Foundry
  if (files.includes("mta.yaml") || files.includes("mta.yml")) add("BTP", files.find((f) => f.startsWith("mta.")), "sap:mta");
  if (files.includes("xs-security.json")) add("XSUAA", "xs-security.json", "sap:xsuaa");
  if (files.includes("manifest.yml")) add("Cloud Foundry", "manifest.yml", "sap:cf-manifest");

  // Fiori/UI5
  if (files.includes("ui5.yaml") || has("webapp/manifest.json") || has("sap.ui") || has("fiori")) {
    add("Fiori/UI5");
    if (files.includes("ui5.yaml")) matches.push({ path: "ui5.yaml", kind: "sap:ui5" });
    const mf = files.find((f) => f.toLowerCase().endsWith("webapp/manifest.json"));
    if (mf) matches.push({ path: mf, kind: "sap:fiori-manifest" });
  }

  // HANA
  if (has(".hdb") || has(".hdbtable") || has(".hdbview") || has("hana") || has(".hdiconfig")) {
    add("HANA");
    const hdi = files.find((f) => f.toLowerCase().includes(".hdiconfig"));
    if (hdi) matches.push({ path: hdi, kind: "sap:hdi" });
  }

  // Integration Suite
  if (has("iflow") || has("integration-suite") || has("cloudintegration")) {
    add("Integration Suite");
    notes.push("Integration Suite artifacts hinted (iFlow / Cloud Integration). Verify manually.");
  }

  // Cloud Connector
  if (has("cloud-connector") || has("scc")) {
    add("Cloud Connector");
  }

  return { signals: [...signals], matches, notes };
}
