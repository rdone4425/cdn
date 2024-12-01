const NodeCache = require('node-cache');
const logger = require('./logger');
const axios = require('axios');
const config = require('./config');

class Monitoring {
    constructor() {
        this.metrics = {
            queryCount: 0,
            errorCount: 0,
            totalResponseTime: 0,
            maxResponseTime: 0,
            minResponseTime: Infinity,
            cacheHits: 0,
            cacheMisses: 0,
            blockedQueries: 0
        };

        this.timeSeriesData = [];
        this.alertStatus = new Map();
        
        // 定期保存监控数据
        setInterval(() => this.saveMetrics(), config.monitoring.interval * 1000);
        
        // 定期检查告警条件
        setInterval(() => this.checkAlerts(), 60000);
    }

    recordQuery(responseTime, success = true) {
        this.metrics.queryCount++;
        if (!success) {
            this.metrics.errorCount++;
        }
        
        this.metrics.totalResponseTime += responseTime;
        this.metrics.maxResponseTime = Math.max(this.metrics.maxResponseTime, responseTime);
        this.metrics.minResponseTime = Math.min(this.metrics.minResponseTime, responseTime);
    }

    recordCacheHit() {
        this.metrics.cacheHits++;
    }

    recordCacheMiss() {
        this.metrics.cacheMisses++;
    }

    recordBlockedQuery() {
        this.metrics.blockedQueries++;
    }

    getMetrics() {
        const totalQueries = this.metrics.queryCount;
        const avgResponseTime = totalQueries > 0 ? 
            this.metrics.totalResponseTime / totalQueries : 0;
        const errorRate = totalQueries > 0 ? 
            (this.metrics.errorCount / totalQueries) * 100 : 0;
        const cacheHitRate = (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 ?
            (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100 : 0;

        return {
            queryCount: totalQueries,
            averageResponseTime: avgResponseTime.toFixed(2),
            maxResponseTime: this.metrics.maxResponseTime.toFixed(2),
            minResponseTime: this.metrics.minResponseTime === Infinity ? 0 : this.metrics.minResponseTime.toFixed(2),
            errorRate: errorRate.toFixed(2),
            cacheHitRate: cacheHitRate.toFixed(2),
            blockedQueries: this.metrics.blockedQueries,
            timeSeriesData: this.timeSeriesData.slice(-60) // 最近60个数据点
        };
    }

    async saveMetrics() {
        const currentMetrics = this.getMetrics();
        this.timeSeriesData.push({
            timestamp: Date.now(),
            ...currentMetrics
        });

        // 只保留最近7天的数据
        const retention = config.monitoring.retention * 24 * 60 * 60 * 1000;
        this.timeSeriesData = this.timeSeriesData.filter(
            data => (Date.now() - data.timestamp) < retention
        );
    }

    async checkAlerts() {
        if (!config.monitoring.alerting.enabled) return;

        const metrics = this.getMetrics();
        for (const rule of config.monitoring.alerting.rules) {
            try {
                const condition = rule.condition;
                const value = eval(condition.replace(/(\w+)/g, (match) => metrics[match] || match));
                
                if (value && !this.alertStatus.get(rule.name)) {
                    // 触发告警
                    this.alertStatus.set(rule.name, true);
                    await this.sendAlert(rule.name, condition, metrics);
                } else if (!value && this.alertStatus.get(rule.name)) {
                    // 告警恢复
                    this.alertStatus.set(rule.name, false);
                    await this.sendRecovery(rule.name, condition, metrics);
                }
            } catch (error) {
                logger.error(`检查告警规则失败 ${rule.name}: ${error.message}`);
            }
        }
    }

    async sendAlert(ruleName, condition, metrics) {
        const message = `告警: ${ruleName}\n条件: ${condition}\n当前值: ${metrics[condition.split(' ')[0]]}`;
        logger.warn(message);

        for (const contact of config.monitoring.alerting.contacts) {
            try {
                if (contact.type === 'email') {
                    // 发送邮件告警
                    // 这里需要实现邮件发送逻辑
                } else if (contact.type === 'webhook') {
                    await axios.post(contact.url, {
                        type: 'alert',
                        ruleName,
                        condition,
                        metrics,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                logger.error(`发送告警失败 ${contact.type}: ${error.message}`);
            }
        }
    }

    async sendRecovery(ruleName, condition, metrics) {
        const message = `恢复: ${ruleName}\n条件: ${condition}\n当前值: ${metrics[condition.split(' ')[0]]}`;
        logger.info(message);

        for (const contact of config.monitoring.alerting.contacts) {
            try {
                if (contact.type === 'webhook') {
                    await axios.post(contact.url, {
                        type: 'recovery',
                        ruleName,
                        condition,
                        metrics,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                logger.error(`发送恢复通知失败 ${contact.type}: ${error.message}`);
            }
        }
    }
}

module.exports = new Monitoring(); 