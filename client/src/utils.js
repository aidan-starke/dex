import Web3 from 'web3'
import Dex from './contracts/Dex.json'
import ERC20Abi from './ERC20Abi.json'
import detectEthereumProvider from '@metamask/detect-provider'

function getWeb3 () {
    return new Promise(async (resolve, reject) => {
        const provider = await detectEthereumProvider()
        if (provider) {
            await provider.request({ method: 'eth_requestAccounts' })
            try {
                const web3 = new Web3(window.ethereum)
                resolve(web3)
            } catch (err) {
                reject(err)
            }
        } reject('Install Metamask')
    })
}

async function getContracts (web3) {
    const networkId = await web3.eth.net.getId()
    const deployedNetwork = Dex.networks[networkId]
    const dex = new web3.eth.Contract(
        Dex.abi,
        deployedNetwork && deployedNetwork.address,
    )
    const tokens = await dex.methods.getTokens().call()
    console.log(tokens)
    const tokenContracts = tokens.reduce((acc, token) => ({
        ...acc,
        [web3.utils.hexToUtf8(token.ticker)]: new web3.eth.Contract(
            ERC20Abi,
            token.tokenAddress
        )
    }), {})
    return { dex, ...tokenContracts }
}

export { getWeb3, getContracts }