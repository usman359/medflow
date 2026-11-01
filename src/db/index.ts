import { Pool, neonConfig, type PoolClient } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-serverless"
import ws from "ws"
import * as schema from "./schema"

// The WebSocket Pool driver (not neon-http) is required: booking runs
// interactive transactions that the HTTP driver cannot express.
neonConfig.webSocketConstructor = ws

/**
 * Neon connections are unreliable from some networks, in two ways:
 *  1. Opening a new WebSocket sometimes fails or stalls ("Connection terminated
 *     unexpectedly", ECONNRESET, a TLS drop).
 *  2. A pooled connection that sat idle can be silently dropped, so the next
 *     query on it fails.
 * Both are handled at checkout, before any real SQL is sent, so retrying is
 * always safe: connect failures are retried, and a connection idle for more
 * than STALE_AFTER_MS is health-checked with `select 1` (and replaced if dead).
 * Failures after a query has started are never retried here.
 */
const CONNECT_ATTEMPTS = 3
const CONNECT_RETRY_DELAY_MS = 250
const STALE_AFTER_MS = 5_000
const HEALTH_CHECK_TIMEOUT_MS = 4_000

function retryConnect(pool: Pool) {
  const connect = pool.connect.bind(pool) as () => Promise<PoolClient>
  const lastReleased = new WeakMap<PoolClient, number>()

  async function checkout(): Promise<PoolClient> {
    const client = await connect()

    // Stamp the release time so the next checkout can tell how long this connection sat idle.
    const release = client.release.bind(client)
    client.release = (error?: Error | boolean) => {
      lastReleased.set(client, Date.now())
      return release(error)
    }

    const releasedAt = lastReleased.get(client)
    if (releasedAt !== undefined && Date.now() - releasedAt > STALE_AFTER_MS) {
      try {
        const check = client.query("select 1")
        check.catch(() => {}) // a late rejection after we give up must not become unhandled
        await Promise.race([
          check,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("health check timed out")), HEALTH_CHECK_TIMEOUT_MS)
          ),
        ])
      } catch (error) {
        client.release(true) // destroy the dead connection
        throw error
      }
    }
    return client
  }

  async function checkoutWithRetry(attempt = 1): Promise<PoolClient> {
    try {
      return await checkout()
    } catch (error) {
      if (attempt >= CONNECT_ATTEMPTS) throw error
      await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_MS * attempt))
      return checkoutWithRetry(attempt + 1)
    }
  }

  // pg's Pool#query calls this.connect with a callback; Pool#connect() with none returns a promise.
  pool.connect = ((
    callback?: (error: Error | undefined, client?: PoolClient, done?: (error?: Error) => void) => void
  ) => {
    const result = checkoutWithRetry()
    if (!callback) return result
    result.then(
      (client) => callback(undefined, client, (error) => client.release(error)),
      (error) => callback(error, undefined, () => {})
    )
  }) as typeof pool.connect
}

function createDb() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.")
  }
  const pool = new Pool({
    connectionString,
    // Fail a stalled connect in 10s (it can otherwise hang for a minute) and let the retry take over.
    connectionTimeoutMillis: 10_000,
    // Reconnecting is slow, so keep connections warm for a minute between requests (stale ones are health-checked).
    idleTimeoutMillis: 60_000,
  })
  // Neon closes idle sockets (and suspends idle computes). The pool emits "error" for the dead
  // connection and discards it; without a listener that event crashes the whole process.
  pool.on("error", (error: Error) => console.error("[db] idle connection error (connection discarded):", error.message))
  retryConnect(pool)
  return drizzle({ client: pool, schema })
}

type Db = ReturnType<typeof createDb>

// Reuse one pool across hot reloads in development. Bump the key when createDb() changes,
// otherwise hot reload keeps serving the previous pool.
const globalForDb = globalThis as unknown as { __medflowDbPoolV2?: Db }

function getDb(): Db {
  if (!globalForDb.__medflowDbPoolV2) {
    globalForDb.__medflowDbPoolV2 = createDb()
  }
  return globalForDb.__medflowDbPoolV2
}

// Lazy: Next.js evaluates route modules during `next build` (page-data collection).
// Creating the pool at import time would fail when DATABASE_URL is unset in CI/Vercel.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb()
    const value = Reflect.get(instance as object, prop, receiver)
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(instance) : value
  },
})

export type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0]
export type DbOrTx = Db | Transaction
export { schema }
