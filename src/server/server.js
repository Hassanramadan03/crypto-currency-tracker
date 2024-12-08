import RPC from '@hyperswarm/rpc';
import DHT from 'hyperdht';
import { schedule } from 'node-cron';
import CoinGeckoService from './coingecko.js';
import DatabaseService from './db.js';

class PriceServer {
  constructor() {
    this.coinGecko = new CoinGeckoService();
    this.database = new DatabaseService();
  }

  async initialize() {
    try {
      await this.database.initialize();
      const dhtSeed = await this.database.getDHTSeed();
      const keyPair = DHT.keyPair(dhtSeed);
      
      this.dht = new DHT({
        keyPair,
        bootstrap: [{ host: '127.0.0.1', port: 30001 }]
      });
      await this.dht.ready();

      const rpcSeed = await this.database.getRPCSeed();
      this.rpc = new RPC({ 
        keyPair: DHT.keyPair(rpcSeed),
        dht: this.dht 
      });
      this.rpcServer = this.rpc.createServer();

      this.bindRPCMethods();
      await this.rpcServer.listen();
      
      console.log('RPC server public key:', this.rpcServer.publicKey.toString('hex'));
    } catch (error) {
      console.error('Initialization error:', error);
      throw error;
    }
  }

  bindRPCMethods() {
      this.rpcServer.respond('getLatestPrices', async (reqRaw) => {
            const req = JSON.parse(reqRaw.toString('utf-8'));
            const pairs = req.pairs || [];
            const prices = await this.database.getLatestPrices(pairs);
            return Buffer.from(JSON.stringify(prices), 'utf-8');
      });

      this.rpcServer.respond('getHistoricalPrices', async (reqRaw) => {
            const req = JSON.parse(reqRaw.toString('utf-8'));
            const { pairs, from, to } = req;
            const prices = await this.database.getHistoricalPrices(pairs, from, to);
            return Buffer.from(JSON.stringify(prices), 'utf-8');
      });
      this.rpcServer.respond('ping', async (reqRaw) => {
            // reqRaw is Buffer, we need to parse it
            const req = JSON.parse(reqRaw.toString('utf-8'))
            console.log(req)
            const resp = { nonce: req.nonce + 1 }
            console.log(req);

            // we also need to return buffer response
            const respRaw = Buffer.from(JSON.stringify(resp), 'utf-8')
            return respRaw
      })
}
 

  async updatePrices() {
    try {
      console.log('Fetching latest prices...');
      const prices = await this.coinGecko.getAllPrices();
      await this.database.storePrices(prices);
      console.log('Prices updated successfully');
    } catch (error) {
      console.error('Error updating prices:', error);
    }
  }

  async start() {
    await this.initialize();
    schedule('*/30 * * * * *', () => this.updatePrices());
    await this.updatePrices();
  }

  async stop() {
    try {
      if (this.rpcServer) await this.rpcServer.close();
      if (this.dht) await this.dht.destroy();
      await this.database.close();
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

const server = new PriceServer();
server.start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await server.stop();
  process.exit(0);
});