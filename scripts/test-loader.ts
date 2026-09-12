/**
 * tsx loader that resolves `server-only` to a no-op stub. Used by the
 * standalone test runner; Next.js handles `server-only` itself via its
 * SWC config.
 */
import Module from "node:module";

const originalResolve = (Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown,
  ) => string;
})._resolveFilename;

(Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown,
  ) => string;
})._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown,
) {
  if (request === "server-only") {
    return require.resolve("./_server-only-stub.js");
  }
  return originalResolve.call(this, request, parent, isMain, options);
};