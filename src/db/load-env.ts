// Imported first by CLI scripts so env vars exist before src/db/index.ts reads them.
import { config } from "dotenv"

config({ path: [".env.local", ".env"], quiet: true })
