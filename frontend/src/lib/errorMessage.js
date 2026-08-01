// lib/errorMessage.js
//
// DRF error responses show up in a few different shapes depending on what
// went wrong:
//   - { detail: "..." }                    — NotFound, PermissionDenied, AuthenticationFailed, throttling, our custom 500 handler
//   - { non_field_errors: ["..."] }        — serializer-level validation (e.g. "Invalid credentials.")
//   - { field_name: ["...", "..."], ... }  — per-field validation errors
//
// Several places in this app used to just discard the response body and
// throw a hardcoded string regardless of what the server actually said —
// e.g. AuthContext's login()/signup() always said "Invalid credentials" /
// "Signup failed" even for a 429 rate limit or a "this email is already in
// use" validation error, and MyFarmDetail's save always said "Save failed.
// Please try again." even when the server explained exactly what was
// wrong with the submitted data. This is the one place that parsing logic
// now lives, so every caller shows the same, real message.

/**
 * Safely parse a fetch Response body as JSON without throwing if it isn't
 * JSON (an HTML error page from a proxy, an empty body, a body that was
 * already consumed, ...).
 */
export async function parseResponseBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Turn a parsed DRF-style error body into a single readable string.
 */
export function extractErrorMessage(body, fallback = 'Something went wrong. Please try again.') {
  if (!body || typeof body !== 'object') return fallback;

  if (typeof body.detail === 'string' && body.detail) return body.detail;

  if (Array.isArray(body.non_field_errors) && body.non_field_errors.length) {
    return body.non_field_errors.join(' ');
  }

  // Per-field errors, e.g. { email: ["A user with this email already exists."] }
  const fieldMessages = Object.entries(body)
    .filter(([, value]) => Array.isArray(value) && value.length)
    .map(([field, messages]) => `${field}: ${messages.join(' ')}`);

  if (fieldMessages.length) return fieldMessages.join(' — ');

  return fallback;
}

/**
 * Convenience wrapper: given a fetch Response already known to have failed
 * (`!response.ok`), parse its body and extract the best message in one call.
 */
export async function extractErrorMessageFromResponse(response, fallback) {
  const body = await parseResponseBody(response);
  return extractErrorMessage(body, fallback);
}
