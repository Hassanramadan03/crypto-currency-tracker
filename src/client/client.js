import RPC from '@hyperswarm/rpc';
import DHT from 'hyperdht';
import crypto from 'crypto';
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";

class PriceClient {
    constructor(serverPublicKey) {
        this.serverPublicKey = Buffer.from(serverPublicKey, 'hex');
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        this.pollInterval = 5000;
    }

    async initialize() {
        const hcore = new Hypercore(`./db/rpc-client-${process.pid}`);
        const hbee = new Hyperbee(hcore, { keyEncoding: 'utf-8', valueEncoding: 'binary' });
        await hbee.ready();

        let dhtSeed = (await hbee.get('dht-seed'))?.value;
        if (!dhtSeed) {
            dhtSeed = crypto.randomBytes(32);
            await hbee.put('dht-seed', dhtSeed);
        }

        try {
            this.dht = new DHT({
                port: 50001,
                keyPair: DHT.keyPair(dhtSeed),
                bootstrap: [{ host: '127.0.0.1', port: 30001 }]
            });
            await this.dht.ready();
            this.rpc = new RPC({ dht: this.dht });

            // Test connection with ping
            const payload = { nonce: 126 };
            const payloadRaw = Buffer.from(JSON.stringify(payload), 'utf-8');
            const respRaw = await this.rpc.request(this.serverPublicKey, 'ping', payloadRaw);
            const resp = JSON.parse(respRaw.toString('utf-8'));
            console.log('Server connection established:', resp);
        } catch (error) {
            console.error('Initialization error:', error);
            throw error;
        }
    }

    async retryRequest(method, payload, attempt = 1) {
        try {
            const payloadRaw = Buffer.from(JSON.stringify(payload), 'utf-8');
            const responseRaw = await this.rpc.request(
                this.serverPublicKey,
                method,
                payloadRaw
            );
            return JSON.parse(responseRaw.toString('utf-8'));
        } catch (error) {
            if (error.code === 'CHANNEL_CLOSED' && attempt < this.retryAttempts) {
                console.log(`Attempt ${attempt} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                await this.initialize();
                return this.retryRequest(method, payload, attempt + 1);
            }
            throw error;
        }
    }

    async getLatestPrices(pairs = []) {
        return this.retryRequest('getLatestPrices', { pairs: pairs.map(p => p.toUpperCase()) });
    }

    async getHistoricalPrices(pairs = [], from, to) {
        return this.retryRequest('getHistoricalPrices', {
            pairs: pairs.map(p => p.toUpperCase()),
            from,
            to
        });
    }

    async startPolling() {
        console.log('Starting continuous price polling...');
        while (true) {
            try {
                const latestPrices = await this.getLatestPrices(['BTC', 'ETH']);
                console.log("\nLatest BTC/ETH Prices:", JSON.stringify(latestPrices, null, 2));

                const allPrices = await this.getLatestPrices([]);
                console.log("\nAll Latest Prices:", JSON.stringify(allPrices, null, 2));

                const toTime = Date.now();
                const fromTime = toTime - (60 * 60 * 1000);
                const historicalPrices = await this.getHistoricalPrices(['BTC', 'ETH'], fromTime, toTime);
                console.log("\nHistorical Prices (Last Hour):", JSON.stringify(historicalPrices, null, 2));

                await new Promise(resolve => setTimeout(resolve, this.pollInterval));
            } catch (error) {
                console.error('Polling error:', error);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
        }
    }

    async close() {
        try {
            if (this.rpc) await this.rpc.destroy();
            if (this.dht) await this.dht.destroy();
            console.log('Client closed successfully');
        } catch (error) {
            console.error('Error during client closure:', error);
            throw error;
        }
    }
}

// Global client instance for shutdown handling
let client;

async function main() {
    if (!process.env.KEY) {
        console.error('Please provide server public key: KEY=<public-key> npm run start:client');
        process.exit(1);
    }

    client = new PriceClient(process.env.KEY);
    
    try {
        await client.initialize();
        await client.startPolling();
    } catch (error) {
        console.error('Fatal error:', error);
        await client.close();
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    console.log('\nGraceful shutdown initiated...');
    try {
        if (client) await client.close();
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

main().catch(console.error);