import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { transform } from '../spec/transform.js';
import { UcTransformer } from './uc-transformer.js';
import { UctLib } from './uct-lib.js';
import { UctSetup } from './uct-setup.js';
import { UctVfs } from './uct-vfs.js';

describe('UctLib', () => {
  let lib: UctLib;
  let createUcTransformer: (program: ts.Program, vfs: UctVfs) => UcTransformer;
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp('target/test-');
    createUcTransformer = (program, vfs) => {
      const setup = new UctSetup(program, vfs, {
        dist: {
          deserializer: `${testDir}/test.ucd-lib.js`,
          serializer: `${testDir}/test.ucs-lib.js`,
        },
        tempDir: testDir,
      });

      lib = new UctLib(setup);

      return new UcTransformer(setup, lib);
    };
  });
  afterEach(async () => {
    await fs.rm(testDir, { recursive: true });
  });

  describe('emitCompilerSource', () => {
    it('emits nothing by default', async () => {
      transform(
        {
          'no-uc.ts': `
console.debug('none');
        `,
        },
        createUcTransformer,
      );

      await expect(lib.emitCompilerSource()).resolves.toBeUndefined();
    });
    it('emits deserializer compilation', async () => {
      transform(
        {
          'deserializer.ts': `
import { createUcDeserializer } from 'churi';

export const readValue = createUcDeserializer(String);
        `,
        },
        createUcTransformer,
      );

      const { fileName, sourceText } = (await lib.emitCompilerSource())!;

      expect(fileName).toBe(path.resolve('src', 'spec', 'tests', 'uc-lib.compiler.ts'));
      expect(sourceText).toContain(` from './deserializer.js';`);
      expect(sourceText).toContain(`test.ucd-lib.js`);
      expect(sourceText).not.toContain(`test.ucs-lib.js`);
      expect(sourceText).toContain(`await compileDeserializers();`);
      expect(sourceText).not.toContain(`compileSerializers`);
    });
    it('emits serializer compilation', async () => {
      transform(
        {
          'serializer.ts': `
import { createUcSerializer } from 'churi';

export const writeValue = createUcSerializer(String);
        `,
        },
        createUcTransformer,
      );

      const { fileName, sourceText } = (await lib.emitCompilerSource())!;

      expect(fileName).toBe(path.resolve('src', 'spec', 'tests', 'uc-lib.compiler.ts'));
      expect(sourceText).toContain(` from './serializer.js';`);
      expect(sourceText).toContain(`test.ucs-lib.js`);
      expect(sourceText).not.toContain(`test.ucd-lib.js`);
      expect(sourceText).toContain(`await compileSerializers();`);
      expect(sourceText).not.toContain(`compileDeserializers`);
    });
    it('emits serializer and deserializer compilation', async () => {
      transform(
        {
          'model.ts': `
import { createUcDeserializer, createUcSerializer } from 'churi';

export const readValue = createUcDeserializer(String);
export const writeValue = createUcSerializer(String);
        `,
        },
        createUcTransformer,
      );

      const { fileName, sourceText } = (await lib.emitCompilerSource())!;

      expect(fileName).toBe(path.resolve('src', 'spec', 'tests', 'uc-lib.compiler.ts'));
      expect(sourceText).toContain(` from './model.js';`);
      expect(sourceText).toContain(`test.ucd-lib.js`);
      expect(sourceText).toContain(`test.ucs-lib.js`);
      expect(sourceText).toContain(`compileDeserializers(),`);
      expect(sourceText).toContain(`compileSerializers(),`);
    });
  });

  describe('compile', () => {
    it('emits deserializer lib', async () => {
      transform(
        {
          'deserializer.ts': `
import { createUcDeserializer } from 'churi';

export const readValue = createUcDeserializer(String);
        `,
        },
        createUcTransformer,
      );

      await lib.compile();

      const file = await fs.readFile(`${testDir}/test.ucd-lib.js`, 'utf-8');

      expect(file).toContain('export function readValue(');
    });
    it('emits serializer lib', async () => {
      transform(
        {
          'serializer.ts': `
import { createUcSerializer } from 'churi';

export const writeValue = createUcSerializer(String);
        `,
        },
        createUcTransformer,
      );

      await lib.compile();

      const file = await fs.readFile(`${testDir}/test.ucs-lib.js`, 'utf-8');

      expect(file).toContain('export async function writeValue(');
    });
  });
});
