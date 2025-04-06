// server/jest.globalTeardown.js
// This script runs once after all test suites.
// server/jest.globalTeardown.js
import { pool } from './db/pool.js';
import { server as mainServer, io as mainIo } from './index.js'; // Import server and io

export default async () => {
  // Close server and io first
  let serverClosePromise = Promise.resolve();
  if (mainServer && mainServer.listening) {
    console.log('\nClosing HTTP server...');
    serverClosePromise = new Promise(resolve => mainServer.close(resolve));
  }
  if (mainIo) {
    console.log('Closing Socket.IO server...');
    mainIo.close();
  }
  await serverClosePromise;
  console.log('HTTP server closed.');

  // Close DB pool last
  if (pool) {
    console.log('Closing database pool after all tests...');
    await pool.end();
    console.log('Database pool closed.');
  }
};