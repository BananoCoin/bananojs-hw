const MAX_PENDING = 10;

const ACCOUNT_INDEX = 0;

window.onLoad = () => {
};

window.checkLedger = async () => {
  try {
    await checkLedgerOrError();
  } catch (error) {
    console.trace(error);
  }
};

window.checkLedgerOrError = async () => {
  const config = window.bananocoinBananojsHw.bananoConfig;
  window.bananocoinBananojs.setBananodeApiUrl(config.bananodeUrl);
  const accountInfoElt = document.getElementById('account');
  const TransportWebUSB = window.TransportWebUSB;
  const isSupportedFlag = await TransportWebUSB.isSupported();
  console.log('connectLedger', 'isSupportedFlag', isSupportedFlag);
  if (isSupportedFlag) {
    const accountData = await window.bananocoin.bananojsHw.getLedgerAccountData(ACCOUNT_INDEX);
    console.log('connectLedger', 'accountData', accountData);
    const account = accountData.account;
    accountInfoElt.innerText = account;

    const accountInfo = await window.bananocoinBananojs.getAccountInfo(account, true);
    console.log('connectLedger', 'accountInfo', accountInfo);
    if (accountInfo.error !== undefined) {
      accountInfoElt.innerText = accountInfo.error;
    } else {
      const balanceParts = await window.bananocoinBananojs.getBananoPartsFromRaw(accountInfo.balance);
      const balanceDescription = await window.bananocoinBananojs.getBananoPartsDescription(balanceParts);
      accountInfoElt.innerText += '\nBalance ' + balanceDescription;

      if (balanceParts.raw == '0') {
        delete balanceParts.raw;
      }

      const bananoDecimal = await window.bananocoinBananojs.getBananoPartsAsDecimal(balanceParts);
      const withdrawAmountElt = document.querySelector('#withdrawAmount');
      withdrawAmountElt.value = bananoDecimal;
      const withdrawAccountElt = document.querySelector('#withdrawAccount');
      withdrawAccountElt.value = account;
    }

    console.log('banano checkpending accountData', account);

    const pendingResponse = await window.bananocoinBananojs.getAccountsPending([account], MAX_PENDING, true);
    console.log('banano checkpending pendingResponse', pendingResponse);
    accountInfoElt.innerText += '\n';
    accountInfoElt.innerText += JSON.stringify(pendingResponse);
    const pendingBlocks = pendingResponse.blocks[account];

    const hashes = [...Object.keys(pendingBlocks)];
    if (hashes.length !== 0) {
      const specificPendingBlockHash = hashes[0];

      const accountSigner = await window.bananocoin.bananojsHw.getLedgerAccountSigner(ACCOUNT_INDEX);

      const bananodeApi = window.bananocoinBananojs.bananodeApi;
      let representative = await bananodeApi.getAccountRepresentative(account);
      if (!(representative)) {
        representative = account;
      }
      console.log('banano checkpending config', config);

      const loggingUtil = window.bananocoinBananojs.loggingUtil;
      const depositUtil = window.bananocoinBananojs.depositUtil;


      accountInfoElt.innerText += '\n';
      accountInfoElt.innerText += 'CHECK LEDGER FOR BLOCK ' + specificPendingBlockHash;

      const receiveResponse = await depositUtil.receive(loggingUtil, bananodeApi, account, accountSigner, representative, specificPendingBlockHash, config.prefix);

      accountInfoElt.innerText += '\n';
      accountInfoElt.innerText += JSON.stringify(receiveResponse);
    }
  }
};

window.withdraw = async () => {
  const withdrawAccountElt = document.querySelector('#withdrawAccount');
  const withdrawAmountElt = document.querySelector('#withdrawAmount');
  const withdrawResponseElt = document.querySelector('#withdrawResponse');
  const withdrawAccount = withdrawAccountElt.value;
  const withdrawAmount = withdrawAmountElt.value;
  const accountSigner = await window.bananocoin.bananojsHw.getLedgerAccountSigner(ACCOUNT_INDEX);
  const bananodeApi = window.bananocoinBananojs.bananodeApi;
  const bananoUtil = window.bananocoinBananojs.bananoUtil;
  const config = window.bananocoinBananojsHw.bananoConfig;
  try {
    const amountRaw = window.bananocoinBananojs.getBananoDecimalAmountAsRaw(withdrawAmount);
    withdrawResponseElt.innerText = 'CHECK LEDGER FOR SEND BLOCK APPROVAL';
    const response = await bananoUtil.sendFromPrivateKey(bananodeApi, accountSigner, withdrawAccount, amountRaw, config.prefix);
    console.log('withdraw', 'response', response);
    withdrawResponseElt.innerText = 'Response' + JSON.stringify(response);
  } catch (error) {
    console.log('withdraw', 'error', error);
    withdrawResponseElt.innerText = 'Error:' + error.message;
  }
};
