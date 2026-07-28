const UNIQUE_VIOLATION_CODE = "23505";
const USERS_EMAIL_UNIQUE_CONSTRAINT = "users_email_unique";

type DatabaseErrorLike = {
  cause?: unknown;
  code?: unknown;
  constraint?: unknown;
  detail?: unknown;
};

function isUniqueEmailError(error: unknown) {
  const visited = new Set<unknown>();
  let current = error;

  while (
    typeof current === "object" &&
    current !== null &&
    !visited.has(current)
  ) {
    visited.add(current);
    const details = current as DatabaseErrorLike;
    const detail = typeof details.detail === "string" ? details.detail : "";

    if (
      details.code === UNIQUE_VIOLATION_CODE &&
      (details.constraint === USERS_EMAIL_UNIQUE_CONSTRAINT ||
        detail.includes("lower(email)") ||
        detail.includes("(email)"))
    ) {
      return true;
    }

    current = details.cause;
  }

  return false;
}

export { isUniqueEmailError };
