# Crypto Price Tracker

Real-time cryptocurrency price tracking system using Hyperswarm RPC and Hypercores.

## Features

- Fetches top 5 cryptocurrencies from CoinGecko
- Tracks prices across top 3 exchanges
- I have added In-memory caching for rate limit handling (CoinGecko public API limit: 429 error) cache will be updated if no error
- Real-time price updates every 30 seconds
- Hyperbee database for persistent storage

## Setup

```bash
npm install
```

## Running the Application

The application needs to be started in this specific order:

1. Start the DHT bootstrap node:

```bash
npm run start:dht
```

2. Start the server:

```bash
npm run start:server
```

Copy the server's public key from the console output.

3. Start the client with the server's public key:

```bash
KEY=<server-public-key> npm run start:client 
```

Replace `<server-public-key>` with the key copied from step 2.

## Example

```bash
# Terminal 1
npm run start:dht

# Terminal 2
npm run start:server
# Output: RPC server public key: 3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29

# Terminal 3
 KEY=3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29 npm run start:client
```
