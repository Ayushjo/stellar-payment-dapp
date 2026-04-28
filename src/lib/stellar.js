import { Horizon, TransactionBuilder, Operation, Asset, Networks, Memo } from '@stellar/stellar-sdk'

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const NETWORK_PASSPHRASE = Networks.TESTNET

export const server = new Horizon.Server(HORIZON_URL)

export async function fetchBalance(publicKey) {
  const account = await server.loadAccount(publicKey)
  const xlmBalance = account.balances.find(b => b.asset_type === 'native')
  return xlmBalance ? parseFloat(xlmBalance.balance).toFixed(4) : '0.0000'
}

export async function buildPaymentTx(senderPublicKey, destinationAddress, amount, memo) {
  const account = await server.loadAccount(senderPublicKey)

  const builder = new TransactionBuilder(account, {
    fee: (await server.fetchBaseFee()).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: destinationAddress,
        asset: Asset.native(),
        amount: amount.toString(),
      })
    )
    .setTimeout(30)

  if (memo && memo.trim()) {
    builder.addMemo(Memo.text(memo.trim()))
  }

  return builder.build().toXDR()
}

export async function submitSignedTx(signedXdr) {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  const result = await server.submitTransaction(tx)
  return result.hash
}

export { NETWORK_PASSPHRASE }
