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
                const monitorStats = monitor.getStats();
                const cacheStats = cache.getStats();
                const lbStats = loadBalancer.getServerStats();
                const upstreamServers = config.getUpstreamServers();
                
                // 构建负载均衡器状态
                const loadBalancerStats = {
                    china: upstreamServers.china.map(server => ({
                        ip: server.ip,
                        name: server.name,
                        ...lbStats[server.ip]
                    })),
                    foreign: upstreamServers.foreign.map(server => ({
                        ip: server.ip,
                        name: server.name,
                        ...lbStats[server.ip]
                    }))
                };
                
                res.json({
                    uptime: monitorStats.uptime,
                    totalQueries: monitorStats.totalQueries,
                    blockedQueries: monitorStats.blockedQueries,
                    averageResponseTime: monitorStats.averageResponseTime,
                    queryHistory: monitorStats.queryHistory,
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
        const port = 3000;
        const maxRetries = 5;
        let currentPort = port;

        const tryListen = () => {
            this.app.listen(currentPort)
                .on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        logger.warn(`Port ${currentPort} is in use, trying ${currentPort + 1}...`);
                        currentPort++;
                        if (currentPort < port + maxRetries) {
                            tryListen();
                        } else {
                            logger.error('Could not find an available port');
                            process.exit(1);
                        }
                    } else {
                        logger.error('HTTP server error:', err);
                        process.exit(1);
                    }
                })
                .on('listening', () => {
                    logger.info(`HTTP服务器启动成功，监听端口 ${currentPort}`);
                    logger.info(`监控面板地址: http://localhost:${currentPort}`);
                });
        };

        tryListen();
    }
}

module.exports = new HTTPServer(); 