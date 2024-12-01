const NodeCache = require('node-cache');
const config = require('./config');

class DNSCache {
    constructor() {
        const { size, ttl } = config.getCacheConfig();
        this.cache = new NodeCache({
            maxKeys: size,
            stdTTL: ttl
        });
        
        // 添加统计计数器
        this.stats = {
            hits: 0,
            misses: 0
        };
    }

    set(key, value) {
        return this.cache.set(key, value);
    }

    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this.stats.hits++;
        } else {
            this.stats.misses++;
        }
        return value;
    }

    has(key) {
        return this.cache.has(key);
    }

    getStats() {
        const keys = this.cache.keys();
        return {
            keys: keys.length,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: this.stats.hits + this.stats.misses === 0 ? 0 :
                (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
        };
    }

    // 清理过期缓存
    prune() {
        return this.cache.prune();
    }
}

module.exports = new DNSCache(); 