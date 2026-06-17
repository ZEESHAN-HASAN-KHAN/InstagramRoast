const LEVELS = ["DEBUG", "INFO", "NOTICE", "WARNING", "ERROR", "CRITICAL"];

const minLevel = () => {
  const env = (process.env.LOG_LEVEL || "INFO").toUpperCase();
  const idx = LEVELS.indexOf(env);
  return idx === -1 ? 1 : idx; // default to INFO
};

function write(severity, message, data = {}) {
  if (LEVELS.indexOf(severity) < minLevel()) return;

  const entry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };
  const line = JSON.stringify(entry);
  if (severity === "ERROR" || severity === "CRITICAL") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

const logger = {
  debug:    (msg, data) => write("DEBUG",    msg, data),
  info:     (msg, data) => write("INFO",     msg, data),
  notice:   (msg, data) => write("NOTICE",   msg, data),
  warning:  (msg, data) => write("WARNING",  msg, data),
  error:    (msg, data) => write("ERROR",    msg, data),
  critical: (msg, data) => write("CRITICAL", msg, data),
};

module.exports = logger;
