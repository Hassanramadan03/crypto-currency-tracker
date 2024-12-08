import Hypercore from 'hypercore';
import Hyperbee from 'hyperbee';
import crypto from 'crypto';

const SEED_LENGTH = 32;

class DatabaseService {
      constructor(dbPath = `./db/crypto-prices-${process.pid}`) {
            this.dbPath = dbPath;
      }

      async initialize() {
            this.core = new Hypercore(this.dbPath);
            this.db = new Hyperbee(this.core, {
                  keyEncoding: 'utf-8',
                  valueEncoding: 'json'
            });
            await this.db.ready();
      }

      async getDHTSeed() {
            let seedData = (await this.db.get('dht-seed'))?.value;
            if (!seedData) {
                  seedData = new Uint8Array(crypto.randomBytes(SEED_LENGTH));
                  await this.db.put('dht-seed', Array.from(seedData));
            }

            const seed = new Uint8Array(SEED_LENGTH);
            seed.set(Array.isArray(seedData) ? new Uint8Array(seedData) : seedData);
            return seed;
      }

      async getRPCSeed() {
            let seedData = (await this.db.get('rpc-seed'))?.value;
            if (!seedData) {
                  seedData = new Uint8Array(crypto.randomBytes(SEED_LENGTH));
                  await this.db.put('rpc-seed', Array.from(seedData));
            }

            const seed = new Uint8Array(SEED_LENGTH);
            seed.set(Array.isArray(seedData) ? new Uint8Array(seedData) : seedData);
            return seed;
      }

      async storePrices(prices) {
            const timestamp = Date.now();
            const batch = this.db.batch();

            // Store current prices with minimal but necessary data
            const compactPrices = prices.map(p => ({
                  s: p.symbol,           // symbol
                  n: p.name,            // name
                  p: p.price,           // price
                  t: p.lastUpdated,     // timestamp
                  e: p.exchanges.map(e => ({
                        n: e.name,          // exchange name
                        v: e.volume         // exchange volume
                  }))
            }));

            await batch.put('latest-prices', {
                  timestamp,
                  prices: compactPrices
            });

            for (const price of compactPrices) {
                  const historicalKey = `historical-${price.s}-${timestamp}`;
                  await batch.put(historicalKey, price);
            }

            await batch.flush();
      }

      async getLatestPrices(symbols = []) {
            try {
                  const latest = (await this.db.get('latest-prices'))?.value;
                  if (!latest) {
                        return [];
                  }

                  const prices = latest.prices.map(p => ({
                        symbol: p.s,
                        name: p.n,
                        price: p.p,
                        lastUpdated: p.t,
                        exchanges: p.e.map(e => ({
                              name: e.n,
                              volume: e.v
                        }))
                  }));

                  if (symbols.length === 0) {
                        return prices;
                  }

                  return prices.filter(p =>
                        symbols.includes(p.symbol.toUpperCase())
                  );
            } catch (error) {
                  console.error('Error getting latest prices:', error);
                  return [];
            }
      }

      async getHistoricalPrices(symbols = [], from, to) {
            const results = [];
            const fromTime = parseInt(from);
            const toTime = parseInt(to);

            try {
                  const stream = this.db.createReadStream({
                        gt: 'historical-',
                        lt: 'historical-\xff'
                  });

                  for await (const { key, value } of stream) {
                        const [, symbol, timestamp] = key.split('-');

                        if (symbols.length > 0 && !symbols.includes(symbol.toUpperCase())) {
                              continue;
                        }

                        const ts = parseInt(timestamp);
                        if (ts >= fromTime && ts <= toTime) {
                              results.push({
                                    symbol: value.s,
                                    name: value.n,
                                    price: value.p,
                                    timestamp: value.t,
                                    exchanges: value.e.map(e => ({
                                          name: e.n,
                                          volume: e.v
                                    }))
                              });
                        }
                  }

                  return results;
            } catch (error) {
                  console.error('Error getting historical prices:', error);
                  return [];
            }
      }

      async close() {
            try {
                  if (this.core) {
                        await this.core.close();
                  }
            } catch (error) {
                  console.error('Error closing database:', error);
            }
      }
}

export default DatabaseService;