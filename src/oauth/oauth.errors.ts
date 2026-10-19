import { HttpException } from '@nestjs/common';

/** RFC 6749 §5.2 error body: { error, error_description }. */
export class OAuthError extends HttpException {
  constructor(
    public readonly error: string,
    public readonly description: string,
    status = 400,
  ) {
    super({ error, error_description: description }, status);
  }
}

/**
 * The request can't be trusted enough to redirect back (unknown client or
 * unregistered redirect URI), so the user sees our error page instead.
 */
export class UnsafeAuthorizeError extends Error {
  constructor(
    public readonly error: string,
    public readonly description: string,
  ) {
    super(description);
  }
}
