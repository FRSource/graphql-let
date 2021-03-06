import { promises } from 'fs';
import { join as pathJoin } from 'path';
import _rimraf from 'rimraf';
import { promisify } from 'util';

export const rimraf = promisify(_rimraf);

const crlf = /\r\n/g;
export function normalizeNewLine(str: string) {
  if (crlf.test(str)) return str.replace(crlf, '\n');
  return str;
}

export const { readFile: _readFile, writeFile, rename } = promises;

export function readFile(file: string) {
  return _readFile(file, 'utf-8').then(normalizeNewLine);
}

export function cleanup(cwd: string) {
  return Promise.all([
    rimraf(pathJoin(cwd, '**/__generated__')),
    rimraf(pathJoin(cwd, '**/node_modules')),
    rimraf(pathJoin(cwd, '**/*.graphql.d.ts')),
    rimraf(pathJoin(cwd, '**/*.graphqls.d.ts')),
  ]);
}
