// Shared constants for the rwxlite 0.2.1 vs 0.2.0 parity check. Info only: exam #3 is burned.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
export const EXAM = path.join(REPO, 'data', 'exam3-2026-11-04');
export const RWXLITE_REPO = '/home/hamr/PycharmProjects/rwxlite';
export const TRUTH_SHA = '929725d51397098b6f45d86a5a551e7f0c095875557a944c02e08930efdab3c0';
export const RELEASE_URL = 'https://github.com/hamr0/rwxlite/releases/download/v0.2.0/';
export const ASSETS = ['manifest.json', 'manifest-exact.json', 'model-int8-pc.onnx', 'model-fp32.onnx', 'vocab.txt'];

/** Package versions under test: git commit and the version its package.json must say. */
export const VERSIONS = {
  '0.2.0': { commit: '6c47fec' },
  '0.2.1': { commit: '308d8e9' },
};

/** The two model variants (same published v0.2.0 weights for both package versions). */
export const VARIANTS = {
  fp32: { manifest: 'manifest-exact.json', modelFile: 'model-fp32.onnx' },
  int8: { manifest: 'manifest.json', modelFile: 'model-int8-pc.onnx' },
};

/** Score.mjs config name for each (mode, variant). */
export const MODES = ['a', 'b95'];
export const configName = (mode, variant) => `${mode}-${variant}`;
