// Set by vitest.config.mts
export const getTestDatabaseUrl = () => {
  const url = process.env.TEST_DATABASE_URL

  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set; run integration tests through vitest.config.mts")
  }

  return url
}

export const getDatabaseName = (url: string) => new URL(url).pathname.replace(/^\//, "")

// Integration tests truncate tables, so they must never run against the dev database from .env
export const assertTestDatabase = (url: string | undefined) => {
  if (!url) {
    throw new Error("DATABASE_URL is not set for integration tests")
  }

  const name = getDatabaseName(url)

  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to run integration tests against database "${name}": its name must end with "_test"`)
  }
}
