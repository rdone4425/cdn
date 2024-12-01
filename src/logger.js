const winston = require('winston');
const { createLogger, format, transports } = winston;
const DailyRotateFile = require('winston-daily-rotate-file');
const config = require('./config');

const logConfig = config.getLoggingConfig();

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
            filename: logConfig.file,
            datePattern: 'YYYY-MM-DD',
            maxSize: logConfig.maxSize,
            maxFiles: logConfig.maxFiles
        })
    ]
});

module.exports = logger; 