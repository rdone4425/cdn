const winston = require('winston');
const { createLogger, format, transports } = winston;
const DailyRotateFile = require('winston-daily-rotate-file');
const config = require('./config');
const path = require('path');

const logConfig = config.getLoggingConfig();

const logDir = '/root/dns/logs';
const logFile = path.join(logDir, 'dns-server.log');

const logger = createLogger({
    level: logConfig.level,
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
            )
        }),
        new DailyRotateFile({
            filename: logFile,
            datePattern: 'YYYY-MM-DD',
            maxSize: logConfig.maxSize,
            maxFiles: logConfig.maxFiles,
            dirname: logDir,
            auditFile: path.join(logDir, '.audit.json')
        })
    ]
});

module.exports = logger; 