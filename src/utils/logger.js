const path = require("path")
const { createLogger, transports, format } = require("winston")
const { combine, timestamp, printf, errors, json } = format

function logFormat() {
  return printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`
  })
}

const dev = createLogger({
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    logFormat()
  ),
  transports: [
    new transports.Console()
  ]
})

const prod = createLogger({
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  transports: [
    new transports.File({
      level: "error",
      dirname: path.resolve("logs"),
      filename: "errors.log"
    }),
    new transports.File({
      level: "info",
      dirname: path.resolve("logs"),
      filename: "combined.log"
    })
  ]
})

module.exports = process.env.NODE_ENV === "production" ? prod : dev