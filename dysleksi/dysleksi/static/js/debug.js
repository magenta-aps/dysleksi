export class DebugConsole {
  logbox;
  originalLog;
  originalWarn;
  originalError;
  isIpad;

  constructor(logboxId = "logbox") {
    this.logbox = document.getElementById(logboxId);

    // ---------- store originals ----------
    this.originalLog = console.log;
    this.originalWarn = console.warn;
    this.originalError = console.error;

    // ---------- override console ----------
    console.log = (...args) => {
      this.originalLog(...args);
      this.writeLine(">", args);
    };

    console.warn = (...args) => {
      this.originalWarn(...args);
      this.writeLine("WARN:", args);
    };

    console.error = (...args) => {
      this.originalError(...args);
      this.writeLine("ERROR:", args);
    };

    // ---------- attach handlers ----------
    window.addEventListener("error", (event) => {
      if (event.error) {
        this.writeLine("UNCAUGHT:", [event.error]);
      } else {
        this.writeLine("UNCAUGHT:", [event.message, event.filename, event.lineno, event.colno]);
      }
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.writeLine("PROMISE:", [event.reason]);
    });

    // ---------- mark start ----------
    this.writeLine(">", ["Debug console attached"]);

    // ---------- iPad hiding ----------
    this.isIpad = /iPad|Macintosh/.test(navigator.userAgent) &&
                  navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
    if (!this.isIpad) {
      this.logbox.style.display = "none";
    }
  }

  // ---------- helpers ----------
  formatArg(a) {
    if (a instanceof Error) {
      return `${a.name}: ${a.message}\n${a.stack}`;
    }
    if (typeof a === "object" && a !== null) {
      try {
        return JSON.stringify(a, null, 2);
      } catch {
        return String(a);
      }
    }
    return String(a);
  }

  writeLine(prefix, args) {
    const line = document.createElement("div");
    line.textContent = `${prefix} ${args.map(a => this.formatArg(a)).join(" ")}`;
    this.logbox.appendChild(line);
    this.logbox.scrollTop = this.logbox.scrollHeight;
  }

}

// auto-init if desired
if (document.getElementById("logbox")) {
  new DebugConsole();
}
