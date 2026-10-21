import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateToolsInput } from '../src/handlers/tools.ts';
import { LAB_MODULES, LAB_TEXT_LIMIT, getLabModule } from '../../shared/lab.ts';

// Ambil satu pasangan tool/id yang benar-benar ada dari LAB_MODULES saat
// runtime, supaya test ini tidak bergantung pada nama modul yang di-hardcode.
const modulesByTool = LAB_MODULES as unknown as Record<string, Record<string, unknown>>;

let sampleTool = '';
let sampleId = '';
for (const tool of Object.keys(modulesByTool)) {
  const ids = Object.keys(modulesByTool[tool]);
  if (ids.length > 0) {
    sampleTool = tool;
    sampleId = ids[0];
    break;
  }
}

test('fixture: LAB_MODULES exposes at least one tool with at least one id', () => {
  assert.ok(sampleTool.length > 0);
  assert.ok(sampleId.length > 0);
  assert.ok(getLabModule(sampleTool, sampleId));
});

test('validateToolsInput accepts a valid tool/id pair from LAB_MODULES', () => {
  const result = validateToolsInput({ tool: sampleTool, id: sampleId });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.tool, sampleTool);
    assert.equal(result.value.id, sampleId);
  }
});

test('validateToolsInput accepts context and question within the limit', () => {
  const result = validateToolsInput({
    tool: sampleTool,
    id: sampleId,
    context: 'Schematic selection shown on screen',
    question: 'Explain this educational selection and its limitations.',
  });
  assert.equal(result.ok, true);
});

test('validateToolsInput rejects an unknown tool', () => {
  const result = validateToolsInput({ tool: 'not-a-real-tool', id: sampleId });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok('error' in result);
  }
});

test('validateToolsInput rejects an unknown id for a valid tool', () => {
  const result = validateToolsInput({ tool: sampleTool, id: 'not-a-real-id' });
  assert.equal(result.ok, false);
});

test('validateToolsInput rejects a prototype pollution tool name', () => {
  const result = validateToolsInput({ tool: '__proto__', id: sampleId });
  assert.equal(result.ok, false);
});

test('validateToolsInput rejects an unknown extra field', () => {
  const result = validateToolsInput({
    tool: sampleTool,
    id: sampleId,
    extraField: 'not allowed',
  });
  assert.equal(result.ok, false);
});

test('validateToolsInput rejects a missing id', () => {
  const result = validateToolsInput({ tool: sampleTool });
  assert.equal(result.ok, false);
});

test('validateToolsInput rejects context longer than LAB_TEXT_LIMIT', () => {
  const result = validateToolsInput({
    tool: sampleTool,
    id: sampleId,
    context: 'a'.repeat(LAB_TEXT_LIMIT + 1),
  });
  assert.equal(result.ok, false);
});

test('validateToolsInput rejects question longer than LAB_TEXT_LIMIT', () => {
  const result = validateToolsInput({
    tool: sampleTool,
    id: sampleId,
    question: 'a'.repeat(LAB_TEXT_LIMIT + 1),
  });
  assert.equal(result.ok, false);
});
