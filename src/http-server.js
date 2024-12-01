const express = require('express');
const path = require('path');
const monitor = require('./monitor');
const cache = require('./cache');
const config = require('./config');
const logger = require('./logger');
const loadBalancer = require('./load-balancer');

class HTTPServer {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.static(path.join(__dirname, '../public')));
        this.app.use(express.json());
    }

    setupRoutes() {
        // API路由
        this.app.get('/api/stats', (req, res) => {
            try {
                const stats = monitor.getStats();
                const cacheStats = cache.getStats();
                const lbStats = loadBalancer.getServerStats();
                const upstreamServers = config.getUpstreamServers();
                
                // 构建负载均衡器状态
                const loadBalancerStats = {
                    china: Object.keys(lbStats)
                        .filter(ip => upstreamServers.china.includes(ip))
                        .map(ip => ({
                            ip,
                            ...lbStats[ip]
                        })),
                    foreign: Object.keys(lbStats)
                        .filter(ip => upstreamServers.foreign.includes(ip))
                        .map(ip => ({
                            ip,
                            ...lbStats[ip]
                        }))
                };
                
                res.json({
                    ...stats,
                    cacheStats: {
                        usage: Math.floor((cacheStats.keys / config.getCacheConfig().size) * 100),
                        hitRate: cacheStats.hitRate,
                        hits: cacheStats.hits,
                        misses: cacheStats.misses,
                        total: cacheStats.keys
                    },
                    loadBalancer: loadBalancerStats
                });
            } catch (error) {
                logger.error('获取统计信息失败:', error);
                res.status(500).json({ error: '获取统计信息失败' });
            }
        });

        // 健康检查
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok' });
        });

        // 错误处理
        this.app.use((err, req, res, next) => {
            logger.error('HTTP服务器错误:', err);
            res.status(500).json({ error: '服务器内部错误' });
        });
    }

    start() {
        const port = 3000; // Web界面端口
        this.app.listen(port, () => {
            logger.info(`HTTP服务器启动成功，监听端口 ${port}`);
            logger.info(`监控面板地址: http://localhost:${port}`);
        });
    }
}

module.exports = new HTTPServer(); 