/* eslint-disable @typescript-eslint/no-non-null-assertion,  @typescript-eslint/no-var-requires */

import { join as pathJoin } from 'path';
import { ok, strictEqual, notStrictEqual } from 'assert';
import glob from 'globby';
import execa from 'execa';
import waitOn from 'wait-on';
import { killApp, timeout } from './__tools/child-process';
import retryable from './__tools/retryable';
import { readFile, writeFile, rimraf } from './__tools/file';

// TODO: Test loader value
// const loadModule = () => {
//   jest.resetModules();
//   return require('./fixtures/hmr/dist/main.js');
// };

type ResultType = {
  schemaDtsPath: string;
  schema: string;
  documentDtsPath: string;
  document: string;
};

const WAIT_FOR_HMR = 90 * 1000;

const cwd = pathJoin(__dirname, '__fixtures/hmr');
const abs = (relPath: string) => pathJoin(cwd, relPath);
const read = (relPath: string) => readFile(abs(relPath));
const spawn = (
  command: string,
  args: string[],
  opts?: execa.CommonOptions<'utf-8'>,
) =>
  execa(command, args, {
    cwd,
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
    ...opts,
  });
const restoreFixtures = () => spawn('git', ['checkout', '.']);

const ensureOutputDts = async (message: string): Promise<ResultType> => {
  const globResults = await glob(['**/*.graphql.d.ts', '**/*.graphqls.d.ts'], {
    cwd,
  });
  strictEqual(
    globResults.length,
    2,
    `"${JSON.stringify(globResults)}" is something wrong. ${message}`,
  );
  const [schemaDtsPath, documentDtsPath] = globResults.sort();
  strictEqual(
    schemaDtsPath,
    'src/type-defs.graphqls.d.ts',
    `${schemaDtsPath} is something wrong. ${message}`,
  );
  strictEqual(
    documentDtsPath,
    'src/viewer.graphql.d.ts',
    `${documentDtsPath} is something wrong. ${message}`,
  );
  return {
    schemaDtsPath: schemaDtsPath,
    schema: await read(schemaDtsPath),
    documentDtsPath: documentDtsPath,
    document: await read(documentDtsPath),
  };
};

describe('HMR', () => {
  let app: execa.ExecaChildProcess;

  beforeEach(async () => {
    await restoreFixtures();
    await rimraf(abs('__generated__'));
    await spawn('node', ['../../../bin/graphql-let.js']);
  });
  afterEach(async () => {
    await killApp(app);
    await restoreFixtures();
  });

  test(
    `should effect to both schema and documents properly`,
    async () => {
      /************************************************************************
       * Ensure the command result
       */
      const result1 = await ensureOutputDts('Ensure the initial state');
      expect(result1.schema).toMatchSnapshot();
      expect(result1.document).toMatchSnapshot();

      /************************************************************************
       * Start dev server
       */
      app = spawn('yarn', ['webpack-dev-server']);
      await waitOn({
        resources: ['http://localhost:3000/main.js'],
        timeout: 60 * 1000,
      });

      /************************************************************************
       * Verify initial loader behavior
       */
      const result2 = await ensureOutputDts('Verify initial loader behavior');
      strictEqual(
        result2.schemaDtsPath,
        result1.schemaDtsPath,
        'Initially Loader should respect cache.',
      );
      strictEqual(
        result2.schema,
        result1.schema,
        'Initially Loader should respect cache.',
      );
      strictEqual(
        result2.documentDtsPath,
        result1.documentDtsPath,
        'Initially Loader should respect cache.',
      );
      strictEqual(
        result2.document,
        result1.document,
        'Initially Loader should respect cache.',
      );

      /************************************************************************
       * Verify HMR on document modification
       */
      await timeout(3 * 1000);
      await writeFile(
        abs('src/viewer.graphql'),
        `
# Add "status" field for testing
query Viewer {
    viewer {
        id
        name
        status
    }
}
`,
        'utf-8',
      );
      await timeout(3 * 1000);

      let result3: ResultType;
      await retryable(
        async () => {
          result3 = await ensureOutputDts(
            'Verify HMR on document modification',
          );
          strictEqual(
            result3.schemaDtsPath,
            result1.schemaDtsPath,
            'Schema should not be effected by document modification.',
          );
          strictEqual(
            result3.schema,
            result1.schema,
            'Schema should not be effected by document modification.',
          );
          notStrictEqual(
            result3.document,
            result1.document,
            'Document should be renewed.',
          );
        },
        1000,
        WAIT_FOR_HMR,
      );
      expect(result3!.schema).toMatchSnapshot();
      expect(result3!.document).toMatchSnapshot();

      /************************************************************************
       * Verify HMR on schema modification - add "age" field
       */
      await timeout(3 * 1000);
      await writeFile(
        abs('src/type-defs.graphqls'),
        `
# Add "age" field for testing
type User {
    id: ID!
    name: String!
    status: String!
    age: Int!
}

type Query {
    viewer: User
}
`.trim(),
        'utf-8',
      );
      await timeout(3 * 1000);

      let result4: ResultType;
      await retryable(
        async () => {
          result4 = await ensureOutputDts(
            'Verify HMR on schema modification - add "age" field',
          );
          notStrictEqual(
            result4.schema,
            result3.schema,
            'Schema should be renewed.',
          );
          notStrictEqual(
            result4.document,
            result3.document,
            'Document should be renewed.',
          );
        },
        1000,
        WAIT_FOR_HMR,
      );
      expect(result4!.schema).toMatchSnapshot();
      expect(result4!.document).toMatchSnapshot();
    },
    5 * 60 * 1000,
  );

  test(
    'should recover after GraphQL Error properly',
    async () => {
      let stderrContent = '';
      const result1 = await ensureOutputDts('');

      /************************************************************************
       * Start dev server
       */
      app = spawn('yarn', ['webpack-dev-server'], { stderr: undefined });
      app.stderr!.on('data', (err) => (stderrContent += String(err)));
      await waitOn({
        resources: ['http://localhost:3000/main.js'],
        timeout: 60 * 1000,
      });

      /************************************************************************
       * Make an error to write wrong GraphQL schema
       */

      await timeout(3 * 1000);
      await writeFile(
        abs('src/type-defs.graphqls'),
        `
type User {
    id: ID!
#    name: String!
#    status: String!
}

type Query {
    viewer: User
}
`.trim(),
        'utf-8',
      );
      await timeout(3 * 1000);

      await retryable(
        async () => {
          expect(stderrContent).toMatch(
            'GraphQLDocumentError: Cannot query field "name" on type "User".',
          );
          const globResults = await glob('__generated__/types/**', { cwd });
          strictEqual(globResults.length, 0);
        },
        1000,
        60 * 1000,
      );
      stderrContent = '';

      /************************************************************************
       * Modifying GraphQL schema should re-generate d.ts properly
       */

      await timeout(3 * 1000);
      await writeFile(
        abs('src/type-defs.graphqls'),
        `
type User {
    id: ID!
    name: String!
    status: String!
}

type Query {
    viewer: User
}
      `.trim(),
        'utf-8',
      );
      await timeout(3 * 1000);

      let result2: ResultType;
      await retryable(
        async () => {
          result2 = await ensureOutputDts('');
          expect(result1.schema).not.toEqual(result2.schema);
          expect(result1.document).not.toEqual(result2.document);
        },
        1000,
        30 * 1000,
      );
      expect(result2!.schema).toMatchSnapshot();
      expect(result2!.document).toMatchSnapshot();
    },
    5 * 60 * 1000,
  );
});
