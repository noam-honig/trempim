import { Pool, PoolClient, QueryResult } from 'pg'
import { Remult, SqlDatabase, remult, repo } from 'remult'
import {
  PostgresDataProvider,
  PostgresPool,
  PostgresSchemaBuilder,
} from 'remult/postgres'
import { versionUpdate } from './version'

export class PostgresSchemaWrapper implements PostgresPool {
  constructor(private pool: Pool, private schema: string) {}

  async connect(): Promise<PoolClient> {
    let r = await this.pool.connect()

    await r.query('set search_path to ' + this.schema)
    return r
  }
  async query(queryText: string, values?: any[]): Promise<QueryResult> {
    let c = await this.connect()
    try {
      return await c.query(queryText, values)
    } finally {
      c.release()
    }
  }
}

export function getPostgresSchemaManager(args: {
  connectionString?: string
  disableSsl: boolean
  entities: any[]
}) {
  const schemaCache = new Map<string, Promise<SqlDatabase>>()
  const pool = new Pool({
    connectionString: args.connectionString || process.env['DATABASE_URL'],
    ssl: args.disableSsl
      ? false
      : {
          rejectUnauthorized: false,
        },
  })
  async function createPostgresDataProviderWithSchema(schema: string) {
    const result = new SqlDatabase(
      new PostgresDataProvider(new PostgresSchemaWrapper(pool, schema))
    )
    remult.dataProvider = result
    const sb = new PostgresSchemaBuilder(result, schema)
    await sb.ensureSchema(args.entities.map((e) => repo(e).metadata))
    await versionUpdate()

    return result
  }
  return {
    getConnectionForSchema(schema: string) {
      let result = schemaCache.get(schema)
      if (!result) {
        schemaCache.set(
          schema,
          (result = createPostgresDataProviderWithSchema(schema))
        )
      }
      return result
    },
  }
}
