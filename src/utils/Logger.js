const winston = require("winston");
const path = require("path");

class Logger {
    constructor() {
        this.logger = winston.createLogger({
            level: "info",
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: "twitter-automation" },
            transports: [
                new winston.transports.File({ 
                    filename: path.join(__dirname, "../../logs/error.log"), 
                    level: "error" 
                }),
                new winston.transports.File({ 
                    filename: path.join(__dirname, "../../logs/combined.log") 
                }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // Track automation metrics
    logActivity(activity, result, duration) {
        this.logger.info("Activity completed", {
            activity,
            result,
            duration,
            timestamp: new Date().toISOString()
        });
    }

    logError(component, error, context = {}) {
        this.logger.error("Component error", {
            component,
            error: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = new Logger();

