const dns2 = require('dns2');
const axios = require('axios');
const config = require('./config');
const cache = require('./cache');
const DomainMatcher = require('./matcher');
const monitor = require('./monitor');
const logger = require('./logger');
const httpServer = require('./http-server');
const loadBalancer = require('./load-balancer');

class DNSServer {
    constructor() {
        this.server = dns2.createServer({ udp: true });
        this.matcher = new DomainMatcher(config.getRules());
        this.adBlockList = new Set();
        this.queryCount = 0;
        this.initAdBlockList();
        this.startHealthCheck();
    }

    async initAdBlockList() {
        const adblockConfig = config.getAdblockConfig();
        if (adblockConfig.enabled) {
            logger.info('正在加载广告域名列表...');
            let totalDomains = 0;
            let successfulLists = 0;

            for (const listUrl of adblockConfig.lists) {
                try {
                    const response = await axios.get(listUrl, {
                        timeout: 10000, // 10秒超时
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    });

                    let domains;
                    if (listUrl.includes('AdGuardSDNSFilter')) {
                        // AdGuard 格式处理
                        domains = response.data.split('\n')
                            .filter(line => line && !line.startsWith('!') && !line.startsWith('#'))
                            .map(line => {
                                const match = line.match(/\|\|([a-zA-Z0-9.-]+)\^/);
                                return match ? match[1] : null;
                            })
                            .filter(domain => domain);
                    } else {
                        // 标准格式处理
                        domains = response.data.split('\n')
                            .filter(line => line && !line.startsWith('#'))
                            .map(line => line.trim());
                    }

                    domains.forEach(domain => this.adBlockList.add(domain));
                    totalDomains += domains.length;
                    successfulLists++;
                    
                    logger.info(`成功从 ${listUrl} 加载 ${domains.length} 个广告域名`);
                } catch (error) {
                    logger.error(`加载广告域名列表失败 ${listUrl}: ${error.message}`);
                    // 继续处理下一个列表
                    continue;
                }
            }

            if (successfulLists > 0) {
                logger.info(`✅ 广告拦截规则加载完成，共加载 ${successfulLists} 个列表，${totalDomains} 个域名`);
            } else {
                logger.warn('⚠️ 所有广告域名列表加载失败，广告拦截功能可能无法正常工作');
            }

            // 设置定时更新
            const updateInterval = adblockConfig.updateInterval * 1000;
            setInterval(() => this.initAdBlockList(), updateInterval);
        }
    }

    startHealthCheck() {
        const lbConfig = config.getLoadBalancerConfig();
        if (lbConfig.healthCheck.enabled) {
            const interval = lbConfig.healthCheck.interval * 1000;
            setInterval(async () => {
                const upstreamServers = config.getUpstreamServers();
                for (const type of ['china', 'foreign']) {
                    for (const server of upstreamServers[type]) {
                        await loadBalancer.healthCheck(server);
                    }
                }
            }, interval);
        }
    }

    async queryUpstream(name, upstreamServers, type) {
        const startTime = Date.now();
        const strategy = config.getLoadBalancerConfig().strategy;
        const server = loadBalancer.selectServer(upstreamServers, type, strategy);
        const serverIP = server.ip || server;

        try {
            const dns = require('dns').promises;
            dns.setServers([serverIP]);
            
            const addresses = await Promise.race([
                dns.resolve4(name),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('DNS查询超时')), config.getDNSTimeout())
                )
            ]);
            
            const responseTime = Date.now() - startTime;
            loadBalancer.updateServerStats(server, responseTime, true);
            monitor.recordResponseTime(responseTime);
            
            logger.info(`解析成功: ${name} -> ${addresses[0]} (上游DNS: ${server.name || serverIP}, 耗时: ${responseTime}ms)`);
            return {
                address: addresses[0],
                server: server,
                responseTime
            };
        } catch (error) {
            loadBalancer.updateServerStats(server, 0, false);
            logger.error(`解析失败: ${name} (上游DNS: ${server.name || serverIP}) - ${error.message}`);
            
            // 如果还有其他服务器可用，尝试下一个
            const remainingServers = upstreamServers.filter(s => s.ip !== serverIP);
            if (remainingServers.length > 0) {
                return this.queryUpstream(name, remainingServers, type);
            }
            
            monitor.recordFailedQuery();
            return null;
        }
    }

    async handleRequest(request, send, client) {
        try {
            const startTime = Date.now();
            const response = dns2.Response.createResponse(request);
            const [question] = request.questions;
            const { name } = question;
            const clientInfo = `${client.address}:${client.port}`;

            if (!name || !this.isValidDomain(name)) {
                logger.warn(`无效的域名请求: ${name}`);
                send(response);
                return;
            }

            monitor.recordQuery({
                domain: name,
                client: clientInfo,
                timestamp: startTime
            });

            logger.info(`[查询 #${this.queryCount++}] 来自 ${clientInfo} 的请求: ${name}`);

            if (this.adBlockList.has(name)) {
                logger.info(`🚫 拦截广告域名: ${name}`);
                monitor.recordBlockedQuery();
                this.addAnswer(response, name, '0.0.0.0');
                send(response);
                return;
            }

            const cachedResult = cache.get(name);
            if (cachedResult && this.isCacheValid(cachedResult)) {
                logger.info(`📦 命中缓存: ${name} -> ${cachedResult.address}`);
                monitor.recordCacheHit();
                this.addAnswer(response, name, cachedResult.address);
                send(response);
                return;
            }

            monitor.recordCacheMiss();
            const action = this.matcher.match(name);
            const upstreamServers = config.getUpstreamServers()[action];
            logger.info(`选择${action === 'china' ? '国内' : '国外'}DNS服务器: ${upstreamServers.join(', ')}`);
            
            const result = await this.queryUpstream(name, upstreamServers, action);
            if (result) {
                cache.set(name, {
                    address: result.address,
                    timestamp: Date.now(),
                    server: result.server
                });
                this.addAnswer(response, name, result.address);
            }

            const responseTime = Date.now() - startTime;
            monitor.recordResponseTime(responseTime);

            const lastQuery = monitor.stats.queryHistory[0];
            if (lastQuery && lastQuery.domain === name) {
                lastQuery.responseTime = responseTime;
                lastQuery.result = result ? result.address : 'Failed';
            }

            send(response);
        } catch (error) {
            logger.error(`处理请求时发生错误: ${error.message}`);
            monitor.recordFailedQuery();
            send(dns2.Response.createResponse(request));
        }
    }

    isValidDomain(domain) {
        const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+[a-zA-Z0-9]$/;
        return pattern.test(domain) && domain.length < 255;
    }

    isCacheValid(cachedResult) {
        const ttl = config.getCacheConfig().ttl * 1000;
        return (Date.now() - cachedResult.timestamp) < ttl;
    }

    addAnswer(response, name, address) {
        response.answers.push({
            name,
            type: dns2.Packet.TYPE.A,
            class: dns2.Packet.CLASS.IN,
            ttl: 300,
            address
        });
    }

    start() {
        const { bind, port } = config.getServerConfig();
        
        this.server.on('request', this.handleRequest.bind(this));
        
        this.server.listen(port, bind)
            .then(() => {
                logger.info('=================================');
                logger.info('🚀 DNS服务器启动成功!');
                logger.info(`📡 监听地址: ${bind}:${port}`);
                logger.info(`🔄 缓存配置: 最大${config.getCacheConfig().size}条记录, TTL ${config.getCacheConfig().ttl}秒`);
                logger.info('🌐 上游DNS服务器:');
                const upstream = config.getUpstreamServers();
                logger.info(`   国内: ${upstream.china.map(s => `${s.name}(${s.ip})`).join(', ')}`);
                logger.info(`   国外: ${upstream.foreign.map(s => `${s.name}(${s.ip})`).join(', ')}`);
                logger.info('=================================');

                // 启动HTTP服务器
                httpServer.start();
            })
            .catch(err => {
                logger.error('❌ DNS服务器启动失败:', err.message);
                process.exit(1);
            });
    }
}

const server = new DNSServer();
server.start();