export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export function sortIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort(
    (left, right) =>
      compareStrings(left.path, right.path) ||
      compareStrings(left.code, right.code) ||
      compareStrings(left.message, right.message)
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function formatIssues(title: string, issues: readonly ValidationIssue[]): string {
  const lines = sortIssues(issues).map(
    (issue) => `- ${issue.path} [${issue.code}]: ${issue.message}`
  );
  return `${title}\n${lines.join('\n')}`;
}

export class ManifestValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    const sorted = sortIssues(issues);
    super(formatIssues('Manifest validation failed:', sorted));
    this.name = 'ManifestValidationError';
    this.issues = sorted;
  }
}

export class CompatibilityError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    const sorted = sortIssues(issues);
    super(formatIssues('Manifest compatibility check failed:', sorted));
    this.name = 'CompatibilityError';
    this.issues = sorted;
  }
}
