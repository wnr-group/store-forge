import type { Instrumentation } from "next";
import { describeError, logEvent } from "@/lib/observability/log";

/**
 * Runs for every uncaught server error (rendering, route handlers, server actions, proxy). Writes one structured line per error
 * and nothing else: no request headers (they carry cookies and tokens), no request body, no query string (it can hold search terms
 * or ids), and the error message is cleaned of SQL parameters, tokens and e-mail addresses. The `digest` ties the line to the
 * error id Next shows in the browser, so a user's report can be found.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  logEvent("error", "request_error", {
    path: request.path.split("?")[0],
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    error: describeError(error),
  });
};
