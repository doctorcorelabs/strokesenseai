import { describe, expect, it } from 'vitest';
import { FEATURES } from '../shared/registry';
import { LAB_MODULES, LAB_RESOURCES } from '../shared/lab';

// Permanent consistency gate: every registry feature must have its own lab
// module with the exact same id, and every lab module must belong to a
// registry feature. A feature page may never borrow another feature's module.
type ModuleShape = {
  title: string;
  facts: readonly string[];
  resources: readonly string[];
};

const modulesById = new Map<string, ModuleShape>();
for (const toolModules of Object.values(LAB_MODULES)) {
  for (const [id, labModule] of Object.entries(toolModules)) {
    modulesById.set(id, labModule as ModuleShape);
  }
}

describe('lab module and registry consistency', () => {
  it('gives every registry feature its own lab module', () => {
    for (const feature of FEATURES) {
      expect(modulesById.has(feature.id), `missing lab module for ${feature.id}`).toBe(true);
    }
  });

  it('gives every lab module at least 3 facts and valid sources', () => {
    for (const feature of FEATURES) {
      const labModule = modulesById.get(feature.id);
      if (!labModule) continue;
      expect(labModule.title.trim().length).toBeGreaterThan(0);
      expect(labModule.facts.length).toBeGreaterThanOrEqual(3);
      for (const fact of labModule.facts) {
        expect(fact.trim().length).toBeGreaterThan(0);
      }
      expect(labModule.resources.length).toBeGreaterThanOrEqual(1);
      const resourcesById = LAB_RESOURCES as Record<string, { title: string; url: string }>;
      for (const resourceId of labModule.resources) {
        expect(
          Object.hasOwn(LAB_RESOURCES, resourceId),
          `invalid source ${resourceId} for ${feature.id}`,
        ).toBe(true);
        const source = resourcesById[resourceId];
        expect(source.title.trim().length).toBeGreaterThan(0);
        expect(source.url).toMatch(/^https:\/\//);
      }
    }
  });

  it('has no lab module without a registry feature', () => {
    const featureIds = new Set(FEATURES.map((feature) => feature.id));
    for (const id of modulesById.keys()) {
      expect(featureIds.has(id), `lab module ${id} has no registry entry`).toBe(true);
    }
    expect(modulesById.size).toBe(FEATURES.length);
  });
});
