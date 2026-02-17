import { mkdir, readFile, writeFile, readdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import crypto from "node:crypto";
import type { Skill } from "./types.js";

/**
 * File-based skill registry.
 *
 * - Skills are stored as Markdown files under a directory (default: ./skills)
 * - An index file (registry.json) stores metadata for fast listing.
 */

export interface SkillRegistryOptions {
  dir: string;
  indexFile?: string;
}

export interface SkillRegistryRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  file: string;
  repo?: Skill["repo"];
}

export class SkillRegistry {
  private readonly indexPath: string;
  constructor(private readonly opts: SkillRegistryOptions) {
    this.indexPath = join(opts.dir, opts.indexFile ?? "registry.json");
  }

  private async loadIndex(): Promise<SkillRegistryRecord[]> {
    const raw = await readFile(this.indexPath, "utf-8").catch(() => "[]");
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SkillRegistryRecord[]) : [];
    } catch {
      return [];
    }
  }

  private async saveIndex(records: SkillRegistryRecord[]): Promise<void> {
    await mkdir(this.opts.dir, { recursive: true });
    await writeFile(this.indexPath, JSON.stringify(records, null, 2), "utf-8");
  }

  /** Register a skill (writes markdown + index record). */
  async register(skill: Omit<Skill, "id" | "createdAt"> & { id?: string; createdAt?: string }): Promise<SkillRegistryRecord> {
    const id = skill.id ?? crypto.randomUUID();
    const createdAt = skill.createdAt ?? new Date().toISOString();
    const file = `${id}.md`;

    await mkdir(this.opts.dir, { recursive: true });
    await writeFile(join(this.opts.dir, file), skill.markdown, "utf-8");

    const records = await this.loadIndex();
    const rec: SkillRegistryRecord = {
      id,
      name: skill.name,
      description: skill.description,
      createdAt,
      file,
      repo: skill.repo,
    };

    const filtered = records.filter((r) => r.id !== id);
    filtered.unshift(rec);
    await this.saveIndex(filtered);
    return rec;
  }

  /** List registered skills. */
  async list(): Promise<SkillRegistryRecord[]> {
    return this.loadIndex();
  }

  /** Find a skill by id or fuzzy name match. */
  async find(query: string): Promise<SkillRegistryRecord | null> {
    const records = await this.loadIndex();
    const q = query.toLowerCase();
    return records.find((r) => r.id === query || r.name.toLowerCase().includes(q)) ?? null;
  }

  /** Install a skill markdown into a destination directory (best-effort). */
  async install(params: { skillIdOrName: string; destDir: string; filename?: string }): Promise<string> {
    const rec = await this.find(params.skillIdOrName);
    if (!rec) throw new Error(`[skills] Skill not found: ${params.skillIdOrName}`);

    await mkdir(params.destDir, { recursive: true });
    const dest = join(params.destDir, params.filename ?? rec.file);
    await copyFile(join(this.opts.dir, rec.file), dest);
    return dest;
  }

  /** Install all registered skills into a destination directory. */
  async installAll(params: { destDir: string }): Promise<string[]> {
    const records = await this.loadIndex();
    await mkdir(params.destDir, { recursive: true });
    const out: string[] = [];
    for (const r of records) {
      const dest = join(params.destDir, r.file);
      await copyFile(join(this.opts.dir, r.file), dest).catch(() => undefined);
      out.push(dest);
    }
    return out;
  }

  /** Rebuild index by scanning *.md files. */
  async rebuildIndex(): Promise<SkillRegistryRecord[]> {
    await mkdir(this.opts.dir, { recursive: true });
    const entries = await readdir(this.opts.dir, { withFileTypes: true });
    const records: SkillRegistryRecord[] = [];

    for (const e of entries) {
      if (!e.isFile() || !e.name.toLowerCase().endsWith(".md")) continue;
      if (e.name === "SKILL.md") continue;
      if (e.name === "README.md") continue;

      const id = e.name.replace(/\.md$/i, "");
      const text = await readFile(join(this.opts.dir, e.name), "utf-8").catch(() => "");
      const firstLine = text.split(/\r?\n/)[0] ?? "";
      const name = firstLine.replace(/^#\s*SKILL:\s*/i, "").trim() || id;
      records.push({ id, name, description: "", createdAt: new Date().toISOString(), file: e.name });
    }

    await this.saveIndex(records);
    return records;
  }
}
