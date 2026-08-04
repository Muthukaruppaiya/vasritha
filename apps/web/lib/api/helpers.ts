export function parseBody<T>(request: Request) {
  return request.json().catch(() => null) as Promise<T | null>;
}
