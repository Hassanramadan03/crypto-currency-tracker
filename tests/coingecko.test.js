import { jest ,expect} from '@jest/globals';
import CoinGeckoService from '../src/server/coingecko.js';
 

describe('CoinGeckoService', () => {
    let service;
    let mockFetch;

    const mockSuccessResponse = {
        currencies: [
            {
                id: 'bitcoin',
                symbol: 'btc',
                name: 'Bitcoin',
                current_price: 99259,
                last_updated: '2024-12-08T09:44:39.168Z'
            }
        ],
        exchanges: [
            {
                id: 'binance',
                name: 'Binance',
                trade_volume_24h_btc: 266854.7923446081
            }
        ]
    };

    beforeEach(() => {
        service = new CoinGeckoService();
        mockFetch = jest.fn();
        global.fetch = mockFetch;
    });

    describe('getTopCurrencies', () => {
      test('successfully fetches currencies', async () => {
            const mockResponse = [{
                id: 'bitcoin',
                symbol: 'btc',
                name: 'Bitcoin',
                current_price: 50000,
                last_updated: '2024-12-08T09:44:39.168Z'
            }];
        
            mockFetch.mockResolvedValueOnce({
                status: 200,
                json: async () => mockResponse
            });
        
            const result = await service.getTopCurrencies(1);
            expect(result[0].symbol).toBe('BTC');
        });
       

     
    });

    describe('getTopExchanges', () => {
        test('successfully fetches exchanges', async () => {
            mockFetch.mockResolvedValueOnce({
                status: 200,
                json: async () => mockSuccessResponse.exchanges
            });

            const result = await service.getTopExchanges(1);
            expect(result[0].name).toBe('Binance');
            expect(result[0].volume_btc).toBeDefined();
        });

        test('handles rate limit (429)', async () => {
            mockFetch.mockResolvedValueOnce({
                status: 429,
                json: async () => ({ error: 'rate limit' })
            });

            const result = await service.getTopExchanges(1);
            expect(result[0].name).toBeDefined();
        });

       
    });

    describe('getExchangePrices', () => {
        test('calculates weighted average price', async () => {
            mockFetch.mockResolvedValue({
                status: 200,
                json: async () => ({
                    tickers: [{
                        target: 'USDT',
                        base: 'BITCOIN',
                        last: 50000
                    }]
                })
            });

            const exchanges = [{
                id: 'binance',
                name: 'Binance',
                volume_btc: 1000
            }];

            const result = await service.getExchangePrices('bitcoin', exchanges);
            expect(result.price).toBeDefined();
            expect(result.exchanges).toHaveLength(1);
        });
    });

    describe('getAllPrices', () => {
        test('aggregates all price data', async () => {
            mockFetch
                .mockResolvedValueOnce({ // currencies
                    status: 200,
                    json: async () => mockSuccessResponse.currencies
                })
                .mockResolvedValueOnce({ // exchanges
                    status: 200,
                    json: async () => mockSuccessResponse.exchanges
                })
                .mockResolvedValue({ // exchange prices
                    status: 200,
                    json: async () => ({
                        tickers: [{
                            target: 'USDT',
                            base: 'BITCOIN',
                            last: 50000
                        }]
                    })
                });

            const result = await service.getAllPrices();
            expect(result).toBeDefined();
            expect(result[0].symbol).toBe('BTC');
            expect(result[0].exchanges).toBeDefined();
        });

     
    });
});