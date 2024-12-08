import fetch from 'node-fetch';

const cachedData = {
      currencies: [
            {
                  id: 'bitcoin',
                  symbol: 'btc',
                  name: 'Bitcoin',
                  current_price: 99259,
                  last_updated: '2024-12-08T09:44:39.168Z'
            },
            {
                  id: 'ethereum',
                  symbol: 'eth',
                  name: 'Ethereum',
                  current_price: 3953.6,
                  last_updated: '2024-12-08T09:44:43.087Z'
            },
            {
                  id: 'ripple',
                  symbol: 'xrp',
                  name: 'XRP',
                  current_price: 2.53,
                  last_updated: '2024-12-08T09:44:38.285Z'
            },
            {
                  id: 'tether',
                  symbol: 'usdt',
                  name: 'Tether',
                  current_price: 1,
                  last_updated: '2024-12-08T09:44:43.792Z'
            },
            {
                  id: 'solana',
                  symbol: 'sol',
                  name: 'Solana',
                  current_price: 235.44,
                  last_updated: '2024-12-08T09:44:40.492Z'
            }
      ],
      exchanges: [
            {
                  id: 'binance',
                  name: 'Binance',
                  trade_volume_24h_btc: 266854.7923446081
            },
            {
                  id: 'bybit_spot',
                  name: 'Bybit',
                  trade_volume_24h_btc: 61623.65309788268
            },
            {
                  id: 'okex',
                  name: 'OKX',
                  trade_volume_24h_btc: 49524.5009821034
            }
      ],
      exchangePrices: {
            'bitcoin': {
                  'binance': 99259,
                  'bybit_spot': 99260,
                  'okex': 99258
            },
            'ethereum': {
                  'binance': 3953,
                  'bybit_spot': 3954,
                  'okex': 3952
            },
            'ripple': {
                  'binance': 2.53,
                  'bybit_spot': 2.52,
                  'okex': 2.53
            },
            'tether': {
                  'binance': 1,
                  'bybit_spot': 1,
                  'okex': 1
            },
            'solana': {
                  'binance': 235.44,
                  'bybit_spot': 235.45,
                  'okex': 235.43
            }
      }
};

class CoinGeckoService {
      constructor() {
            this.baseUrl = 'https://api.coingecko.com/api/v3';
      }

      async getTopCurrencies(count = 5) {
            const mapCurrencies = currencies => currencies.map(coin => ({
                  id: coin.id,
                  symbol: coin.symbol.toUpperCase(),
                  name: coin.name,
                  price: coin.current_price,
                  last_updated: coin.last_updated
            }))
            try {
                  const url = `${this.baseUrl}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${count}&page=1`
                  const response = await fetch(url);

                  if (response.status === 429) {
                        console.log('Rate limit hit, using cached currency data');
                        return mapCurrencies(cachedData.currencies)
                  }
                  const data = await response.json();
                  console.log("TOPCURRENCIES:", data);
                  if (!Array.isArray(data)) {
                        console.error(data)
                        throw new Error('Invalid API response format');
                  }
                  cachedData.currencies = data;
                  return mapCurrencies(data);
            } catch (error) {
                  // console.error('Error fetching top currencies:', error);
                  return Promise.reject(error);
            }
      }

      async getTopExchanges(count = 3) {
            const mapExchanges = (exchanges) =>
                  exchanges.map((exchange) => ({
                        id: exchange.id,
                        name: exchange.name,
                        volume_btc: exchange.trade_volume_24h_btc,
                  }));
            try {
                  const url = `${this.baseUrl}/exchanges?per_page=${count}`;
                  const response = await fetch(url);
                  if (response.status === 429) {
                        console.log('Rate limit hit, using cached exchange data');
                        return mapExchanges(cachedData.exchanges)
                  }
                  const data = await response.json();
                  console.log("TOPEXCHANGES:", data);
                  if (!Array.isArray(data)) {
                        throw new Error('Invalid API response format');
                  }
                  cachedData.exchanges = data;
                  return mapExchanges(data)
            } catch (error) {
                  // console.error('Error fetching top exchanges:', error);
                  return Promise.reject(error);
            }
      }


      async getExchangePrices(coinId, exchanges) {
            try {
                  const mapper = async exchange => {
                        let response;
                        try {
                              response = await fetch(`${this.baseUrl}/exchanges/${exchange.id}/tickers?coin_ids=${coinId}&base=${t.base}&target=USDT`
                              );

                        } catch (error) {
                              // console.error(  `Error fetching exchange prices for ${exchange.id}:`)
                        }
                        if (response?.status === 429||!response) {
                              return {
                                    exchange: exchange.name,
                                    price: cachedData?.exchangePrices[coinId]?.[exchange.id] || 0,
                                    volume: exchange.volume_btc
                              };
                        }

                        const data = await response?.json();
                        const usdtPair = data?.tickers?.find(t =>
                              t.target === 'USDT' &&
                              t.base.toLowerCase() === coinId
                        );
                        const price = usdtPair?.last || 0;
                        if (!price) {
                              return {
                                    exchange: exchange.name,
                                    price: cachedData?.exchangePrices[coinId]?.[exchange.id] || 0,
                                    volume: exchange.volume_btc
                              };
                        }

                        if (!cachedData.exchangePrices[coinId]) {
                              cachedData.exchangePrices[coinId] = {};
                        }
                        cachedData.exchangePrices[coinId][exchange.id] = price;

                        return {
                              exchange: exchange.name,
                              price,
                              volume: exchange.volume_btc
                        };
                  }
                  const promises = exchanges.map(mapper);
                  const exchangePrices = await Promise.all(promises

                  );

                  const totalVolume = exchangePrices.reduce((sum, ex) => sum + ex.volume, 0);
                  const weightedAvgPrice = exchangePrices.reduce(
                        (sum, ex) => sum + (ex.price * (ex.volume / totalVolume)),
                        0
                  );

                  return {
                        price: weightedAvgPrice,
                        lastUpdated: Date.now(),
                        exchanges: exchangePrices
                  };
            } catch (error) {
                  // console.error(`Error fetching price for ${coinId}:`, error);
                  return Promise.reject(error);
            }
      }


      async getAllPrices() {
            try {
                  const [currencies, exchanges] = await Promise.all([
                        this.getTopCurrencies(),
                        this.getTopExchanges()
                  ]);
                  const mapper = async currency => {
                        const exchangeData = await this.getExchangePrices(currency.id, exchanges);
                        return {
                              symbol: currency.symbol,
                              name: currency.name,
                              price: exchangeData.price,
                              lastUpdated: new Date(currency.last_updated).getTime(),
                              exchanges: exchangeData.exchanges
                        };
                  }
                  const promises = currencies.map(mapper)
                  const pricesWithExchanges = await Promise.all(promises);

                  return pricesWithExchanges;
            } catch (error) {
                  // console.error('Error in getAllPrices:', error);
                  throw error;
            }
      }
}

export default CoinGeckoService;