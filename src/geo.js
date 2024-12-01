const axios = require('axios');
const NodeCache = require('node-cache');
const logger = require('./logger');

class GeoIP {
    constructor() {
        // 缓存IP地理位置信息，TTL为1天
        this.cache = new NodeCache({
            stdTTL: 86400,
            checkperiod: 3600
        });
    }

    async lookup(ip) {
        try {
            // 检查缓存
            const cached = this.cache.get(ip);
            if (cached) {
                return cached;
            }

            // 使用纯真IP数据库API
            const response = await axios.get(`https://ip.useragentinfo.com/json?ip=${ip}`, {
                timeout: 3000
            });

            if (response.data && response.data.country) {
                const result = {
                    country: response.data.country,
                    province: response.data.province,
                    city: response.data.city,
                    isp: response.data.isp,
                    inChina: response.data.country === '中国'
                };
                
                // 缓存结果
                this.cache.set(ip, result);
                return result;
            }
        } catch (error) {
            logger.error(`IP地理位置查询失败 ${ip}: ${error.message}`);
        }

        // 查询失败时的默认值
        return {
            country: 'Unknown',
            province: 'Unknown',
            city: 'Unknown',
            isp: 'Unknown',
            inChina: false
        };
    }

    // 获取缓存统计
    getStats() {
        return {
            keys: this.cache.keys().length,
            hits: this.cache.getStats().hits,
            misses: this.cache.getStats().misses
        };
    }
}

module.exports = new GeoIP(); 