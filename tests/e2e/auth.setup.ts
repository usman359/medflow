import { test as setup } from "@playwright/test"
import { ACCOUNTS, authFile, signInViaApi, type AccountKey } from "./helpers"

for (const key of Object.keys(ACCOUNTS) as AccountKey[]) {
  setup(`sign in as ${key}`, async ({ playwright, baseURL }) => {
    const context = await playwright.request.newContext({ baseURL })
    await signInViaApi(context, baseURL!, ACCOUNTS[key])
    await context.storageState({ path: authFile(key) })
    await context.dispose()
  })
}
