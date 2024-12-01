const NodeCache = require('node-cache');
const logger = require('./logger');
const config = require('./config');

class Security {
    constructor() {
        this.requestCounter = new NodeCache({
            stdTTL: 60,
            checkperiod: 30
        });

        this.blacklist = new NodeCache({
            stdTTL: 300,
            checkperiod: 60
        });

        this.ddosCounter = {
            requests: 0,
            lastReset: Date.now()
        };

        setInterval(() => {
            this.ddosCounter.requests = 0;
            this.ddosCounter.lastReset = Date.now();
        }, 1000);
    }

    checkRequest(clientIP) {
        try {
            // 检查是否被封禁
            if (this.blacklist.get(clientIP)) {
                return {
                    allowed: false,
                    reason: 'IP已被封禁'
                };
            }

            // DDoS保护
            this.ddosCounter.requests++;
            if (this.ddosCounter.requests > 5000) {
                logger.warn(`检测到可能的DDoS攻击，当前请求率: ${this.ddosCounter.requests}/秒`);
                return {
                    allowed: false,
                    reason: '请求过于频繁'
                };
            }

            // 速率限制
            const count = this.requestCounter.get(clientIP) || 0;
            if (count >= 1000) {
                this.blacklist.set(clientIP, true);
                logger.warn(`IP ${clientIP} 因请求过多被封禁`);
                return {
                    allowed: false,
                    reason: '超过请求限制'
                };
            }
            this.requestCounter.set(clientIP, count + 1);

            return {
                allowed: true
            };
        } catch (error) {
            logger.error(`安全检查失败: ${error.message}`);
            return {
                allowed: true
            };
        }
    }

    getStats() {
        return {
            blockedIPs: this.blacklist.keys().length,
            currentRequestRate: this.ddosCounter.requests,
            activeClients: this.requestCounter.keys().length
        };
    }
}

module.exports = new Security();