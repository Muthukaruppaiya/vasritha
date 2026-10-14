/**
 * Hosting / runtime detection — primary production host is Vercel.
 * Netlify / AWS Lambda still detected for compatibility.
 */

export function isHostedRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NODE_ENV === "production"
  );
}

export function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

/** Human-readable host name for error messages. */
export function hostedEnvLabel() {
  if (process.env.VERCEL) return "Vercel";
  if (process.env.NETLIFY) return "Netlify";
  return "your hosting provider";
}
