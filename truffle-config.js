const path = require('path')
require('dotenv').config()
const HDWalletProvider = require('@truffle/hdwallet-provider')

const { RINKEBY_RPC_URL, MNEMONIC } = process.env

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
    },
    rinkeby: {
      provider: () => new HDWalletProvider(
        MNEMONIC,
        RINKEBY_RPC_URL
      ),
      network_id: 4,
    }
  },
  contracts_build_directory: path.join(__dirname, 'client/src/contracts'),
  compilers: {
    solc: {
      version: '^0.8.0',
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

};
