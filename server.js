'use strict';

require('dotenv').config();

const http = require('node:http');
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const port = Number(process.env.PORT || 3000);
const databaseName = process.env.MONGODB_DB || 'cbsua_supply_office';

if (!uri) {
  console.error('MONGODB_URI is required. Copy .env.example to .env and configure it.');
  process.exit(1);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}

async function start() {
  let client;

  try {
    client = new MongoClient(uri);
    await client.connect();
    const database = client.db(databaseName);
    console.log(`Connected to MongoDB database "${databaseName}".`);

    const server = http.createServer(async (request, response) => {
      if (request.method !== 'GET' || request.url !== '/health') {
        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      try {
        await database.command({ ping: 1 });
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'ok', database: databaseName }));
      } catch (error) {
        console.error('MongoDB health check failed.', error);
        response.writeHead(503, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'MongoDB is unavailable' }));
      }
    });

    server.on('error', async error => {
      console.error('The backend server could not start.', error);
      await client.close();
      process.exitCode = 1;
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`MongoDB connection health check: http://127.0.0.1:${port}/health`);
    });

    let shuttingDown = false;
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      server.close(async error => {
        if (error) {
          console.error('The backend server could not shut down cleanly.', error);
          process.exitCode = 1;
        }
        await client.close();
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Could not connect to MongoDB or start the backend.', error);
    if (client) await client.close();
    process.exitCode = 1;
  }
}

start();
