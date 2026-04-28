import { useState, useEffect } from 'react'
import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  signTransaction,
  getNetworkDetails,
} from '@stellar/freighter-api'
import { fetchBalance, buildPaymentTx, submitSignedTx, NETWORK_PASSPHRASE } from './lib/stellar'

export default function App() {
  const [freighterInstalled, setFreighterInstalled] = useState(null)
  const [publicKey, setPublicKey] = useState('')
  const [balance, setBalance] = useState(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [sending, setSending] = useState(false)
  const [txResult, setTxResult] = useState(null)

  useEffect(() => {
    isConnected().then(({ isConnected: connected }) => {
      setFreighterInstalled(!!connected)
      if (connected) {
        isAllowed().then(({ isAllowed: allowed }) => {
          if (allowed) restoreSession()
        })
      }
    })
  }, [])

  async function restoreSession() {
    const { address, error } = await getAddress()
    if (!error && address) {
      setPublicKey(address)
      loadBalance(address)
    }
  }

  async function loadBalance(key) {
    setBalanceLoading(true)
    try {
      const bal = await fetchBalance(key)
      setBalance(bal)
    } catch {
      setBalance('Error')
    } finally {
      setBalanceLoading(false)
    }
  }

  async function handleConnect() {
    const { address, error } = await requestAccess()
    if (error) {
      alert('Could not connect: ' + error)
      return
    }
    setPublicKey(address)
    loadBalance(address)
  }

  function handleDisconnect() {
    setPublicKey('')
    setBalance(null)
    setTxResult(null)
  }

  async function handleSend(e) {
    e.preventDefault()
    setTxResult(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTxResult({ success: false, message: 'Enter a valid amount greater than 0.' })
      return
    }

    setSending(true)
    try {
      const networkDetails = await getNetworkDetails()
      if (networkDetails.networkPassphrase !== NETWORK_PASSPHRASE) {
        setTxResult({ success: false, message: 'Please switch Freighter to Testnet and try again.' })
        setSending(false)
        return
      }

      const xdr = await buildPaymentTx(publicKey, destination, parsedAmount.toFixed(7), memo)

      const { signedTxXdr, error: signError } = await signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      })
      if (signError) throw new Error(signError)

      const hash = await submitSignedTx(signedTxXdr)
      setTxResult({ success: true, hash })
      setDestination('')
      setAmount('')
      setMemo('')
      loadBalance(publicKey)
    } catch (err) {
      const msg = err?.response?.data?.extras?.result_codes
        ? JSON.stringify(err.response.data.extras.result_codes)
        : err.message || 'Transaction failed.'
      setTxResult({ success: false, message: msg })
    } finally {
      setSending(false)
    }
  }

  function shortKey(key) {
    return `${key.slice(0, 8)}...${key.slice(-8)}`
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-star">✦</span>
          <span>StellarPay</span>
        </div>
        {publicKey && (
          <button className="btn btn-outline" onClick={handleDisconnect}>
            Disconnect
          </button>
        )}
      </header>

      <main className="main">
        {freighterInstalled === null && (
          <div className="card center-card">
            <p className="muted">Detecting Freighter wallet…</p>
          </div>
        )}

        {freighterInstalled === false && (
          <div className="card center-card warn-card">
            <div className="big-icon">⚠️</div>
            <h2>Freighter Not Detected</h2>
            <p>
              Install the{' '}
              <a href="https://freighter.app" target="_blank" rel="noreferrer">
                Freighter browser extension
              </a>
              , then refresh this page.
            </p>
          </div>
        )}

        {freighterInstalled && !publicKey && (
          <div className="card center-card hero-card">
            <div className="hero-star">✦</div>
            <h1>Stellar Testnet Pay</h1>
            <p className="subtitle">
              Connect your Freighter wallet to send XLM instantly on Stellar Testnet.
            </p>
            <button className="btn btn-primary btn-lg" onClick={handleConnect}>
              Connect Freighter Wallet
            </button>
            <p className="hint">
              Make sure Freighter is set to <strong>Testnet</strong> before connecting.
            </p>
          </div>
        )}

        {publicKey && (
          <>
            <div className="card wallet-card">
              <div className="wallet-row">
                <div>
                  <p className="field-label">Connected Wallet</p>
                  <p className="address" title={publicKey}>{shortKey(publicKey)}</p>
                  <span className="badge">Testnet</span>
                </div>
                <div className="balance-section">
                  <p className="field-label">XLM Balance</p>
                  {balanceLoading ? (
                    <p className="balance">Loading…</p>
                  ) : (
                    <p className="balance">
                      {balance ?? '—'} <span className="unit">XLM</span>
                    </p>
                  )}
                  <button className="btn btn-sm" onClick={() => loadBalance(publicKey)}>
                    ↻ Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="card send-card">
              <h2>Send XLM</h2>
              <form onSubmit={handleSend} className="form">
                <div className="field">
                  <label>Recipient Address</label>
                  <input
                    type="text"
                    placeholder="G... (Stellar public key)"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    required
                    spellCheck={false}
                  />
                </div>
                <div className="field">
                  <label>Amount <span className="muted">(XLM)</span></label>
                  <input
                    type="number"
                    placeholder="0.00"
                    min="0.0000001"
                    step="any"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label>Memo <span className="optional">(optional)</span></label>
                  <input
                    type="text"
                    maxLength={28}
                    placeholder="e.g. payment for coffee"
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary btn-full" type="submit" disabled={sending}>
                  {sending ? 'Signing & Sending…' : 'Send XLM →'}
                </button>
              </form>
            </div>

            {txResult && (
              <div className={`card result-card ${txResult.success ? 'result-success' : 'result-fail'}`}>
                {txResult.success ? (
                  <>
                    <div className="result-icon success-icon">✓</div>
                    <h3>Transaction Sent!</h3>
                    <p className="field-label">Transaction Hash</p>
                    <a
                      className="tx-hash"
                      href={`https://stellar.expert/explorer/testnet/tx/${txResult.hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {txResult.hash}
                    </a>
                    <p className="hint">↑ Click to view on Stellar Expert Explorer</p>
                  </>
                ) : (
                  <>
                    <div className="result-icon fail-icon">✗</div>
                    <h3>Transaction Failed</h3>
                    <p className="error-msg">{txResult.message}</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p>Running on <strong>Stellar Testnet</strong> · Powered by Freighter &amp; Horizon API</p>
      </footer>
    </div>
  )
}
