import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import DatabaseService from '../src/server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('DatabaseService', () => {
    let db;
    const testDbPath = `${__dirname}/../test-db-${Date.now()}`;

    beforeEach(async () => {
        db = new DatabaseService(testDbPath);
        await db.initialize();
    });

    afterEach(async () => {
        await db.close();
    });

    describe('Seed Management', () => {
        test('generates and retrieves DHT seed', async () => {
            const seed = await db.getDHTSeed();
            expect(seed).toBeInstanceOf(Uint8Array);
            expect(seed.length).toBe(32);
        });

        test('generates and retrieves RPC seed', async () => {
            const seed = await db.getRPCSeed();
            expect(seed).toBeInstanceOf(Uint8Array);
            expect(seed.length).toBe(32);
        });
    });

    describe('Price Storage', () => {
        const samplePrices = [{
            symbol: 'BTC',
            name: 'Bitcoin',
            price: 50000,
            lastUpdated: Date.now(),
            exchanges: [
                { name: 'Binance', volume: 1000 },
                { name: 'Coinbase', volume: 2000 }
            ]
        }];

        test('stores and retrieves prices', async () => {
            await db.storePrices(samplePrices);
            const prices = await db.getLatestPrices(['BTC']);
            expect(prices[0].symbol).toBe('BTC');
            expect(prices[0].price).toBe(50000);
            expect(prices[0].exchanges).toHaveLength(2);
        });

        test('retrieves all prices when no symbols provided', async () => {
            await db.storePrices(samplePrices);
            const prices = await db.getLatestPrices();
            expect(prices).toHaveLength(1);
        });

        
    });

    describe('Historical Prices', () => {
        test('retrieves historical prices within timeframe', async () => {
            const now = Date.now();
            const prices = [{
                symbol: 'BTC',
                name: 'Bitcoin',
                price: 50000,
                lastUpdated: now,
                exchanges: [{ name: 'Binance', volume: 1000 }]
            }];

            await db.storePrices(prices);
            const historical = await db.getHistoricalPrices(
                ['BTC'],
                now - 3600000,
                now + 3600000
            );

            expect(historical[0].symbol).toBe('BTC');
        });
    });
});