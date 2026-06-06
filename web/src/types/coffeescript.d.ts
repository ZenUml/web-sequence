declare module 'coffeescript' {
  export function compile(code: string, options?: Record<string, unknown>): string;
  const _default: { compile: typeof compile };
  export default _default;
}
