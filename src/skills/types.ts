/**
 * Skill Generator types.
 * Skills are Markdown instructions (portable).
 */

export interface RepoFileMatch {
  path: string;
  kind: string;
  hints?: string[];
}

export interface RepoAnalysis {
  root: string;
  name: string;
  detected: {
    languages: string[];
    frameworks: string[];
    runtimes: string[];
    databases: string[];
    sap: string[];
    cicd: string[];
  };
  files: RepoFileMatch[];
  readme?: string;
  packageJson?: any;
  notes: string[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  repo: {
    name: string;
    root: string;
  };
  markdown: string;
}

export interface SkillBundle {
  id: string;
  name: string;
  createdAt: string;
  skills: Skill[];
  meta?: Record<string, unknown>;
}
