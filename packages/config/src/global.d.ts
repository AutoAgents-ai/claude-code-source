// Minimal process.env declaration — avoids @types/node dependency
// while keeping this package self-contained
declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
}
