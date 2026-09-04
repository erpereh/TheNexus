/** @type {import("prettier").Config} */
export default {
  semi: true,
  singleQuote: true,
  printWidth: 100,
  trailingComma: 'all',
  // Repos store LF; Windows checkouts may use CRLF (core.autocrlf + text=auto).
  // "auto" keeps `format:check` green on both instead of flagging ~180 files
  // for line-ending-only differences. See docs/execution/progress.md.
  endOfLine: 'auto',
};
