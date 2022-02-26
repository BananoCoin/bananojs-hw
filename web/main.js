const MAX_PENDING = 10;

const ACCOUNT_INDEX = 0;

let accountSigner = undefined;
let accountData = undefined;
let ledgerInUse = false;
const config = window.bananocoinBananojsHw.bananoConfig;

window.onLoad = async () => {
  await synchUI();
};

window.checkLedger = async () => {
  try {
    await checkLedgerOrError();
  } catch (error) {
    console.trace(error);
  }
};

const clearAllPasswordInfo = () => {
  clearNewPasswordInfo();
  document.getElementById('oldSeedPassword').value = '';
};

const clearNewPasswordInfo = () => {
  document.getElementById('newSeed').value = '';
  document.getElementById('newSeedPassword').value = '';
};

const clearAccountInfo = async () => {
  accountSigner = undefined;
  accountData = undefined;
  document.getElementById('accountInfo').innerText = '';
  document.getElementById('withdrawAmount').value = '';
  document.getElementById('withdrawAccount').value = '';
  await synchUI();
};

const getAccountInfo = async () => {
  window.bananocoinBananojs.setBananodeApiUrl(config.bananodeUrl);
  const accountInfoElt = document.getElementById('accountInfo');
  const account = accountData.account;
  let innerText = `${account}\n`;
  const accountInfo = await window.bananocoinBananojs.getAccountInfo(
      account,
      true,
  );
  // console.log('getAccountInfo', 'accountInfo', accountInfo);
  if (accountInfo.error !== undefined) {
    innerText += `${accountInfo.error}\n`;
  } else {
    const balanceParts = await window.bananocoinBananojs.getBananoPartsFromRaw(
        accountInfo.balance,
    );
    const balanceDescription =
      await window.bananocoinBananojs.getBananoPartsDescription(balanceParts);
    innerText += `Balance ${balanceDescription}\n`;

    if (balanceParts.raw == '0') {
      delete balanceParts.raw;
    }

    const bananoDecimal =
      await window.bananocoinBananojs.getBananoPartsAsDecimal(balanceParts);
    const withdrawAmountElt = document.getElementById('withdrawAmount');
    withdrawAmountElt.value = bananoDecimal;
    const withdrawAccountElt = document.getElementById('withdrawAccount');
    withdrawAccountElt.value = account;
  }
  // console.log('banano checkpending accountData', account);

  const pendingResponse = await window.bananocoinBananojs.getAccountsPending(
      [account],
      MAX_PENDING,
      true,
  );
  console.log('banano checkpending pendingResponse', pendingResponse);
  const pendingBlocks = pendingResponse.blocks[account];

  if (pendingBlocks !== undefined) {
    const hashes = [...Object.keys(pendingBlocks)];
    if (hashes.length !== 0) {
      const specificPendingBlockHash = hashes[0];

      innerText += '\n';
      innerText += `Receiving hash 1 of ${hashes.length}\n`;

      const bananodeApi = window.bananocoinBananojs.bananodeApi;
      let representative = await bananodeApi.getAccountRepresentative(account);
      if (!representative) {
        representative = account;
      }
      // console.log('banano checkpending config', config);

      const loggingUtil = window.bananocoinBananojs.loggingUtil;
      const depositUtil = window.bananocoinBananojs.depositUtil;

      if (ledgerInUse) {
        innerText += `CHECK LEDGER FOR BLOCK ${specificPendingBlockHash}\n`;
      } else {
        innerText += `RECEIVING BLOCK ${specificPendingBlockHash}\n`;
      }
      accountInfoElt.innerText = innerText;

      console.log('banano checkpending account', account);
      console.log('banano checkpending accountSigner', accountSigner);
      console.log('banano checkpending representative', representative);
      console.log(
          'banano checkpending specificPendingBlockHash',
          specificPendingBlockHash,
      );

      const receiveResponse = await depositUtil.receive(
          loggingUtil,
          bananodeApi,
          account,
          accountSigner,
          representative,
          specificPendingBlockHash,
          config.prefix,
      );

      innerText += `${receiveResponse.receiveMessage}\n`;
      innerText += `${receiveResponse.pendingMessage}\n`;
    }
  }
  accountInfoElt.innerText = innerText;
  await synchUI();
};

window.checkLedgerOrError = async () => {
  clearAllPasswordInfo();
  clearAccountInfo();
  window.bananocoinBananojs.setBananodeApiUrl(config.bananodeUrl);
  const TransportWebUSB = window.TransportWebUSB;
  const isSupportedFlag = await TransportWebUSB.isSupported();
  console.log('connectLedger', 'isSupportedFlag', isSupportedFlag);
  if (isSupportedFlag) {
    accountSigner = await window.bananocoin.bananojsHw.getLedgerAccountSigner(
        ACCOUNT_INDEX,
    );
    accountData = {
      publicKey: accountSigner.getPublicKey(),
      account: accountSigner.getAccount(),
    };
    ledgerInUse = true;
    clearAllPasswordInfo();
    await synchUI();
    console.log('connectLedger', 'accountData', accountData);
    await getAccountInfo();
  }
};

window.withdraw = async () => {
  const withdrawAccountElt = document.querySelector('#withdrawAccount');
  const withdrawAmountElt = document.querySelector('#withdrawAmount');
  const withdrawResponseElt = document.querySelector('#withdrawResponse');
  const withdrawAccount = withdrawAccountElt.value;
  const withdrawAmount = withdrawAmountElt.value;
  const bananodeApi = window.bananocoinBananojs.bananodeApi;
  const bananoUtil = window.bananocoinBananojs.bananoUtil;
  const config = window.bananocoinBananojsHw.bananoConfig;
  try {
    const amountRaw =
      window.bananocoinBananojs.getBananoDecimalAmountAsRaw(withdrawAmount);
    if (ledgerInUse) {
      withdrawResponseElt.innerText = 'CHECK LEDGER FOR SEND BLOCK APPROVAL\n';
    }
    const response = await bananoUtil.sendFromPrivateKey(
        bananodeApi,
        accountSigner,
        withdrawAccount,
        amountRaw,
        config.prefix,
    );
    console.log('withdraw', 'response', response);
    withdrawResponseElt.innerText = 'Response' + JSON.stringify(response);
  } catch (error) {
    console.log('withdraw', 'error', error);
    withdrawResponseElt.innerText = 'Error:' + error.message;
  }
};

const setAccountSignerDataFromSeed = async (seed) => {
  const privateKey = await window.bananocoinBananojs.getPrivateKey(seed, 0);
  const publicKey = await window.bananocoinBananojs.getPublicKey(privateKey);
  const account = window.bananocoinBananojs.getBananoAccount(publicKey);

  accountSigner = privateKey;
  accountData = {
    publicKey: publicKey,
    account: account,
  };
  await getAccountInfo();
};

const setAccountSignerDataFromMnemonic = async (mnemonic) => {
  const seed = window.bip39.mnemonicToEntropy(mnemonic);
  await setAccountSignerDataFromSeed(seed);
};

window.checkOldSeed = async () => {
  clearAccountInfo();
  clearNewPasswordInfo();
  const encryptedSeed = window.localStorage.getItem('encryptedSeed');
  if (encryptedSeed == undefined) {
    alert('no seed found in local storage');
  } else {
    const oldSeedPassword = document.getElementById('oldSeedPassword').value;
    console.log('checkOldSeed', 'encryptedSeed', encryptedSeed);
    console.log('checkOldSeed', 'oldSeedPassword', oldSeedPassword);
    try {
      unencryptedSeed = await window.bananocoin.passwordUtils.decryptData(
          encryptedSeed,
          oldSeedPassword,
      );
      console.log('checkOldSeed', 'unencryptedSeed', unencryptedSeed);
      // alert(unencryptedSeed);
      await setAccountSignerDataFromSeed(unencryptedSeed);
    } catch (error) {
      console.trace('checkOldSeed', 'error', error);
      alert(error.message);
    }
  }
};

window.clearOldSeed = async () => {
  const encryptedSeed = window.localStorage.getItem('encryptedSeed');
  if (encryptedSeed == undefined) {
    alert('no seed found in local storage');
  } else {
    if (confirm('Clear saved seed, are you sure? This is not reversible.')) {
      window.localStorage.removeItem('encryptedSeed');
    }
  }
  clearAllPasswordInfo();
  clearAccountInfo();
};

window.newRandomSeed = async () => {
  const seedBytes = new Uint8Array(32);
  window.crypto.getRandomValues(seedBytes);
  const seed = window.bananocoinBananojs.bananoUtil.bytesToHex(seedBytes);
  document.getElementById('newSeed').value = seed;
};

window.checkNewSeed = async () => {
  clearAccountInfo();
  const newSeed = document.getElementById('newSeed').value;
  const newSeedPassword = document.getElementById('newSeedPassword').value;
  console.log('checkNewSeed', 'newSeed', newSeed);
  console.log('checkNewSeed', 'newSeedPassword', newSeedPassword);
  const encryptedSeed = await window.bananocoin.passwordUtils.encryptData(
      newSeed,
      newSeedPassword,
  );
  window.localStorage.setItem('encryptedSeed', encryptedSeed);
  console.log('checkNewSeed', 'encryptedSeed', encryptedSeed);
  console.log(
      'checkNewSeed',
      'localStorage.encryptedSeed',
      window.localStorage.getItem('encryptedSeed'),
  );
  unencryptedSeed = await window.bananocoin.passwordUtils.decryptData(
      encryptedSeed,
      newSeedPassword,
  );
  console.log('checkNewSeed', 'unencryptedSeed', unencryptedSeed);
  // alert(unencryptedSeed);
  document.getElementById('oldSeedPassword').value = newSeedPassword;
  clearNewPasswordInfo();
  await setAccountSignerDataFromSeed(unencryptedSeed);
};

window.checkOldMnemonic = async () => {
  clearAccountInfo();
  clearNewPasswordInfo();
  const encryptedMnemonic = window.localStorage.getItem('encryptedMnemonic');
  if (encryptedMnemonic == undefined) {
    alert('no mnemonic found in local storage');
  } else {
    const oldMnemonicPassword = document.getElementById('oldMnemonicPassword').value;
    console.log('checkOldMnemonic', 'encryptedMnemonic', encryptedMnemonic);
    console.log('checkOldMnemonic', 'oldMnemonicPassword', oldMnemonicPassword);
    try {
      unencryptedMnemonic = await window.bananocoin.passwordUtils.decryptData(
          encryptedMnemonic,
          oldMnemonicPassword,
      );
      console.log('checkOldMnemonic', 'unencryptedMnemonic', unencryptedMnemonic);
      // alert(unencryptedMnemonic);
      await setAccountSignerDataFromMnemonic(unencryptedMnemonic);
    } catch (error) {
      console.trace('checkOldMnemonic', 'error', error);
      alert(error.message);
    }
  }
};

window.clearOldMnemonic = async () => {
  const encryptedMnemonic = window.localStorage.getItem('encryptedMnemonic');
  if (encryptedMnemonic == undefined) {
    alert('no mnemonic found in local storage');
  } else {
    if (confirm('Clear saved mnemonic, are you sure? This is not reversible.')) {
      window.localStorage.removeItem('encryptedMnemonic');
    }
  }
  clearAllPasswordInfo();
  clearAccountInfo();
};

window.newRandomMnemonic = async () => {
  const seedBytes = new Uint8Array(32);
  window.crypto.getRandomValues(seedBytes);
  const seed = window.bananocoinBananojs.bananoUtil.bytesToHex(seedBytes);
  const mnemonic = window.bip39.entropyToMnemonic(seed);
  document.getElementById('newMnemonic').value = mnemonic;
};

window.checkNewMnemonic = async () => {
  clearAccountInfo();
  const newMnemonic = document.getElementById('newMnemonic').value;
  const newMnemonicPassword = document.getElementById('newMnemonicPassword').value;
  console.log('checkNewMnemonic', 'newMnemonic', newMnemonic);
  console.log('checkNewMnemonic', 'newMnemonicPassword', newMnemonicPassword);
  const encryptedMnemonic = await window.bananocoin.passwordUtils.encryptData(
      newMnemonic,
      newMnemonicPassword,
  );
  window.localStorage.setItem('encryptedMnemonic', encryptedMnemonic);
  console.log('checkNewMnemonic', 'encryptedMnemonic', encryptedMnemonic);
  console.log(
      'checkNewMnemonic',
      'localStorage.encryptedMnemonic',
      window.localStorage.getItem('encryptedMnemonic'),
  );
  unencryptedMnemonic = await window.bananocoin.passwordUtils.decryptData(
      encryptedMnemonic,
      newMnemonicPassword,
  );
  console.log('checkNewMnemonic', 'unencryptedMnemonic', unencryptedMnemonic);
  // alert(unencryptedMnemonic);
  document.getElementById('oldMnemonicPassword').value = newMnemonicPassword;
  clearNewPasswordInfo();
  await setAccountSignerDataFromMnemonic(unencryptedMnemonic);
};

const synchUI = async () => {
  const hide = (id) => {
    document
        .getElementById(id)
        .setAttribute('class', 'border_black display_none');
  };
  const show = (id) => {
    document.getElementById(id).setAttribute('class', 'border_black');
  };
  hide('unsupportedLedger');
  hide('unsupportedCrypto');
  hide('checkLedger');
  hide('checkOldSeed');
  hide('clearOldSeed');
  hide('checkNewSeed');
  hide('checkOldMnemonic');
  hide('clearOldMnemonic');
  hide('checkNewMnemonic');
  hide('accountData');
  const isSupportedFlag = await window.TransportWebUSB.isSupported();
  if (isSupportedFlag) {
    show('checkLedger');
  } else {
    show('unsupportedLedger');
  }

  if (window.bananocoin.passwordUtils.enabled()) {
    const encryptedSeed = window.localStorage.getItem('encryptedSeed');
    console.log('synchUI', 'encryptedSeed', encryptedSeed);
    if (encryptedSeed == undefined) {
      show('checkNewSeed');
    } else {
      show('checkOldSeed');
      show('clearOldSeed');
    }
    const encryptedMnemonic = window.localStorage.getItem('encryptedMnemonic');
    console.log('synchUI', 'encryptedMnemonic', encryptedMnemonic);
    if (encryptedMnemonic == undefined) {
      show('checkNewMnemonic');
    } else {
      show('checkOldMnemonic');
      show('clearOldMnemonic');
    }
  } else {
    show('unsupportedCrypto');
  }

  if (accountData !== undefined) {
    show('accountData');
  }
};
