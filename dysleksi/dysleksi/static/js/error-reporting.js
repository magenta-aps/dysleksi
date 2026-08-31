// Forwards JavaScript errors and warnings in the browser to the server, so they
// end up in the docker logs

// Number of reports a single page may send. Reaching the limit is reported,
// so the log never goes quiet without saying so.
const MAX_REPORTS = 25;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_STACK_LENGTH = 4000;

export class ErrorReporter {
    url;
    csrfToken;
    maxReports;
    reportCount;
    originalError;
    originalWarn;

    constructor(url, csrfToken, maxReports = MAX_REPORTS) {
        this.url = url;
        this.csrfToken = csrfToken;
        this.maxReports = maxReports;
        this.reportCount = 0;
        this.originalError = console.error;
        this.originalWarn = console.warn;

        console.error = (...args) => {
            this.originalError(...args);
            this.reportConsole("console.error", args);
        };

        console.warn = (...args) => {
            this.originalWarn(...args);
            this.reportConsole("console.warn", args);
        };

        window.addEventListener("error", (event) => {
            this.report({
                kind: "uncaught",
                message: event.error
                    ? this.formatArg(event.error)
                    : event.message || "Unknown error",
                stack: this.stackOf(event.error),
                source: this.formatSource(event),
            });
        });

        window.addEventListener("unhandledrejection", (event) => {
            this.report({
                kind: "unhandledrejection",
                message: this.formatArg(event.reason),
                stack: this.stackOf(event.reason),
            });
        });
    }

    reportConsole(kind, args) {
        this.report({
            kind: kind,
            message: args.map((arg) => this.formatArg(arg)).join(" "),
            stack: this.stackOf(args.find((arg) => arg instanceof Error)),
        });
    }

    stackOf(value) {
        if (value instanceof Error) {
            // Not every browser fills in `stack` on every error
            return value.stack ?? null;
        }
        return null;
    }

    formatArg(arg) {
        if (arg instanceof Error) {
            return `${arg.name}: ${arg.message}`;
        }
        if (typeof arg === "object" && arg !== null) {
            try {
                return JSON.stringify(arg);
            } catch {
                return String(arg);
            }
        }
        return String(arg);
    }

    formatSource(event) {
        if (!event.filename) {
            return null;
        }
        return `${event.filename}:${event.lineno}:${event.colno}`;
    }

    report({ kind, message, stack = null, source = null }) {
        if (this.reportCount > this.maxReports) {
            return;
        }
        this.reportCount++;
        if (this.reportCount > this.maxReports) {
            this.send(
                "limit",
                `Reached the limit of ${this.maxReports} reports for this page ` +
                    "load, further errors and warnings are not reported",
            );
            return;
        }
        this.send(kind, message, stack, source);
    }

    async send(kind, message, stack = null, source = null) {
        const payload = {
            kind: kind,
            message: message.slice(0, MAX_MESSAGE_LENGTH),
            stack: stack === null ? null : stack.slice(0, MAX_STACK_LENGTH),
            source: source,
            url: window.location.href,
            user_agent: navigator.userAgent,
        };
        try {
            await fetch(this.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": this.csrfToken,
                },
                body: JSON.stringify(payload),
                // Let the request outlive a page that is being navigated away
                // from, so errors happening during teardown are not lost.
                keepalive: true,
            });
        } catch (error) {
            // Report the original error
            this.originalError("Could not report error to server:", error);
        }
    }
}

const configElement = document.getElementById("client-error-log-config");
if (configElement) {
    const config = JSON.parse(configElement.textContent);
    new ErrorReporter(config.url, config.csrf_token);
}
