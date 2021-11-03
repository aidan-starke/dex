import React, { useEffect, useState } from 'react'
import { getWeb3, getContracts } from './utils'
import App from './App.js'

function LoadingContainer () {
    const [web3, setWeb3] = useState()
    const [accounts, setAccounts] = useState([])
    const [contracts, setContracts] = useState()

    async function init () {
        const web3 = await getWeb3()
        const contracts = await getContracts(web3)
        const accounts = await web3.eth.getAccounts()

        setWeb3(web3)
        setContracts(contracts)
        setAccounts(accounts)
    }

    useEffect(() => {
        init()
    }, [])

    function isReady () {
        return (
            typeof web3 !== 'undefined'
            && typeof contracts !== 'undefined'
            && accounts.length > 0
        )
    }

    if (!isReady())
        return <div>Loading...</div>

    return <App web3={web3} accounts={accounts} contracts={contracts} />

}

export default LoadingContainer