import { describe, expect, it } from 'vitest';
import {
  buildDatasourceConfigObject,
  buildGetTableArg,
  generateDefaultDatabaseSourceCode,
  normalizeDatabaseSettings,
  patchDatabaseSourceInCode,
  resolveDatabaseDataCodeVariableName,
} from './databaseSourceDataCodeSync.js';

describe('databaseSourceDataCodeSync', () => {
  it('migrates legacy connectionString to dbUrl', () => {
    const s = normalizeDatabaseSettings({
      dbType: 'postgresql',
      connectionString: 'postgres://u:p@localhost:5432/db',
    });
    expect(s.dbUrl).toBe('postgres://u:p@localhost:5432/db');
    expect(s.dbConnectionMode).toBe('url');
  });

  it('builds fields-mode postgres config', () => {
    const cfg = buildDatasourceConfigObject({
      dbType: 'postgresql',
      dbConnectionMode: 'fields',
      dbHost: 'localhost',
      dbPort: 5432,
      database: 'datacode',
      dbUsername: 'postgres',
      dbPassword: 'postgres',
      dbTimeout: 10,
    });
    expect(cfg).toEqual({
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'datacode',
      username: 'postgres',
      password: 'postgres',
      timeout: 10,
    });
  });

  it('builds url-mode mysql config', () => {
    const cfg = buildDatasourceConfigObject({
      dbType: 'mysql',
      dbConnectionMode: 'url',
      dbUrl: 'mysql://root:root@localhost:3306/datacode',
      dbTimeout: 10,
    });
    expect(cfg).toEqual({
      type: 'mysql',
      url: 'mysql://root:root@localhost:3306/datacode',
      timeout: 10,
    });
  });

  it('builds sqlite path and mongodb collection get_table', () => {
    expect(buildDatasourceConfigObject({
      dbType: 'sqlite',
      dbConnectionMode: 'fields',
      dbPath: './app.db',
    })).toEqual({ type: 'sqlite', path: './app.db' });

    expect(buildGetTableArg({
      dbType: 'mongodb',
      dbCollection: 'users',
    })).toBe('{ collection: "users" }');
  });

  it('builds SQL get_table from table name', () => {
    expect(buildGetTableArg({
      dbType: 'postgresql',
      dbTable: 'users',
    })).toBe('{ sql: "SELECT * FROM users" }');
  });

  it('generates full datasource/connect/get_table/disconnect block', () => {
    const code = generateDefaultDatabaseSourceCode({
      dbType: 'postgresql',
      dbConnectionMode: 'url',
      dbUrl: 'postgres://postgres:postgres@localhost:5432/datacode',
      query: 'SELECT * FROM users ORDER BY id',
      dbTable: 'users',
      dbTimeout: 10,
    });
    expect(code).toContain('db = datasource({');
    expect(code).toContain('type: "postgresql"');
    expect(code).toContain('url: "postgres://postgres:postgres@localhost:5432/datacode"');
    expect(code).toContain('db.connect()');
    expect(code).toContain('db.get_table({ sql: "SELECT * FROM users ORDER BY id" })');
    expect(code).toContain('db.disconnect()');
    expect(code).toContain('print("users: ", table_info(users))');
    expect(code).not.toContain('from ws import');
  });

  it('patches existing block and keeps trailing code', () => {
    const existing = [
      'db = datasource({',
      '    type: "mysql",',
      '    url: "mysql://root:root@localhost:3306/old"',
      '})',
      'db.connect()',
      'global users = db.get_table({ sql: "SELECT 1" })',
      'db.disconnect()',
      'print("keep me")',
    ].join('\n');

    const { code, variableName } = patchDatabaseSourceInCode(existing, {
      dbType: 'mysql',
      dbConnectionMode: 'url',
      dbUrl: 'mysql://root:root@localhost:3306/datacode',
      dbTable: 'users',
      query: 'SELECT * FROM users',
    });

    expect(variableName).toBe('users');
    expect(code).toContain('url: "mysql://root:root@localhost:3306/datacode"');
    expect(code).toContain('SELECT * FROM users');
    expect(code).toContain('print("keep me")');
  });

  it('resolves variable name from table', () => {
    expect(resolveDatabaseDataCodeVariableName({ dbTable: 'orders' })).toBe('orders');
  });
});
