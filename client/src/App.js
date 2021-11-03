import React, { useEffect, useState } from 'react'
import { Header, Wallet, Footer, NewOrder, AllOrders, MyOrders, AllTrades } from './components'

const SIDE = {
  BUY: 0,
  SELL: 1
}

function App ({ web3, accounts, contracts }) {
  const [tokens, setTokens] = useState([])
  const [user, setUser] = useState({
    accounts: [],
    balances: {
      tokenDex: 0,
      tokenWallet: 0
    },
    selectedToken: undefined
  })
  const [orders, setOrders] = useState({
    buy: [],
    sell: []
  })
  const [trades, setTrades] = useState([])
  const [listener, setListener] = useState()

  const getBalances = (account, token) => {
    let tokenDex

    return contracts.dex.methods
      .traderBalances(account, web3.utils.fromAscii(token.ticker))
      .call()
      .then(res => {
        tokenDex = res
        return contracts[token.ticker].methods
          .balanceOf(account)
          .call()
      })
      .then(tokenWallet => ({ tokenDex, tokenWallet }))
  }

  const getOrders = token =>
    Promise.all([
      contracts.dex.methods
        .getOrders(web3.utils.fromAscii(token.ticker), SIDE.BUY)
        .call(),
      contracts.dex.methods
        .getOrders(web3.utils.fromAscii(token.ticker), SIDE.SELL)
        .call(),
    ])
      .then(orders => ({ buy: orders[0], sell: orders[1] }))


  const listenToTrades = token => {
    const tradeIds = new Set()
    setTrades([])

    const listener = contracts.dex.events.NewTrade({
      filter: { ticker: web3.utils.fromAscii(token.ticker) },
      fromBlock: 0
    })
      .on('data', newTrade => {
        if (tradeIds.has(newTrade.returnValues.tradeId)) return
        tradeIds.add(newTrade.returnValues.tradeId)
        setTrades(trades => ([...trades, newTrade.returnValues]))
      })
    setListener(listener)
  }

  const selectToken = token => setUser({ ...user, selectedToken: token })

  const refreshBalances = () =>
    getBalances(
      user.accounts[0],
      user.selectedToken
    )
      .then(balances => setUser(user => ({ ...user, balances })))

  const deposit = amount =>
    contracts[user.selectedToken.ticker].methods
      .approve(contracts.dex.options.address, amount)
      .send({ from: user.accounts[0] })
      .then(() => contracts.dex.methods
        .deposit(
          amount,
          web3.utils.fromAscii(user.selectedToken.ticker)
        )
        .send({ from: user.accounts[0] }))
      .then(() => refreshBalances())

  const withdraw = amount =>
    contracts.dex.methods
      .withdraw(
        amount,
        web3.utils.fromAscii(user.selectedToken.ticker)
      )
      .send({ from: user.accounts[0] })
      .then(() => refreshBalances())

  const createMarketOrder = (amount, side) => {
    return contracts.dex.methods
      .createMarketOrder(
        web3.utils.fromAscii(user.selectedToken.ticker),
        amount,
        side
      )
      .send({ from: user.accounts[0] })
      .then(() => getOrders(user.selectedToken))
      .then(res => setOrders(res))
  }

  const createLimitOrder = (amount, price, side) =>
    contracts.dex.methods
      .createLimitOrder(
        web3.utils.fromAscii(user.selectedToken.ticker),
        amount,
        price,
        side
      )
      .send({ from: user.accounts[0] })
      .then(() => getOrders(user.selectedToken))
      .then(res => setOrders(res))

  const getBalancesAndOrders = selectedToken =>
    Promise.all([
      getBalances(accounts[0], selectedToken),
      getOrders(selectedToken),
    ])
      .then(res => ({ balances: res[0], orders: res[1] }))

  const getTokens = () =>
    contracts.dex.methods.getTokens().call()
      .then(res => {
        const tokens = res.map(token => ({
          ...token,
          ticker: web3.utils.hexToUtf8(token.ticker)
        }))
        setTokens(tokens)
        return tokens
      })

  const init = tokens =>
    getBalancesAndOrders(tokens[0])
      .then(({ balances, orders }) => {
        console.log('tokens', tokens)
        console.log('user.accounts', user.accounts)
        listenToTrades(tokens[0])
        setUser({ accounts, balances, selectedToken: tokens[0] })
        setOrders(orders)
      })

  useEffect(() => {
    getTokens()
      .then(init)
    //eslint-disable-next-line
  }, [])

  useEffect(() => {
    if (typeof user.selectedToken !== 'undefined')
      init([user.selectedToken])
    //eslint-disable-next-line
  }, [user.selectedToken], () => {
    listener.unsubscribe()
  })

  if (typeof user.selectedToken === 'undefined')
    return <div>Loading...</div>

  return (
    <div id='app'>
      <Header
        contracts={contracts}
        tokens={tokens}
        user={user}
        selectToken={selectToken}
      />
      <main className='container-fluid'>
        <div className='row'>
          <div className='col-sm-4 first-col'>
            <Wallet
              user={user}
              deposit={deposit}
              withdraw={withdraw}
            />
            {user.selectedToken.ticker !== 'DAI' &&
              <NewOrder
                createMarketOrder={createMarketOrder}
                createLimitOrder={createLimitOrder}
              />}
          </div>
          {user.selectedToken.ticker !== 'DAI' &&
            <div className='col-sm-8'>
              <AllTrades
                trades={trades}
              />
              <AllOrders
                orders={orders}
              />
              <MyOrders
                orders={{
                  buy: orders.buy.filter(
                    order => order.trader.toLowerCase() === user.accounts[0].toLowerCase()
                  ),
                  sell: orders.sell.filter(
                    order => order.trader.toLowerCase() === user.accounts[0].toLowerCase()
                  )
                }}
              />
            </div>
          }
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default App
