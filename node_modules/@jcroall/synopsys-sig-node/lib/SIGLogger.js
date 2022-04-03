"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
var winston = require('winston');
exports.logger = winston.createLogger({
    //    level: 'debug',
    transports: [
        new (winston.transports.Console)({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        })
    ],
});
