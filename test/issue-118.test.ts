import { join as pathJoin } from 'path';
import { rimraf } from './__tools/file';

const cwd = pathJoin(__dirname, '__fixtures/issue-118');
const abs = (relPath: string) => pathJoin(cwd, relPath);
import gen from '../src/gen';

describe('"baseUrl" and "mappers" combo', () => {
  beforeAll(async () => {
    await rimraf(abs('__generated__'));
    await rimraf(abs('**/*.graphql.d.ts'));
    await rimraf(abs('**/*.graphqls.d.ts'));
  });

  it('should run graphql-let command properly', async () => {
    await gen({ cwd });
  });
});
