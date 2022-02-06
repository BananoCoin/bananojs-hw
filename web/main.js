const MAX_PENDING = 10;

const ACCOUNT_INDEX = 0;

let accountSigner = undefined;
let accountData = undefined;
const config = window.bananocoinBananojsHw.bananoConfig;

window.onLoad = () => {
};

window.checkLedger = async () => {
  try {
    await checkLedgerOrError();
  } catch (error) {
    console.trace(error);
  }
};

const clearAccountInfo = () => {
  accountSigner = undefined;
  accountData = undefined;
  document.getElementById('account').innerText = '';
  document.getElementById('withdrawAmount').value = '';
  document.getElementById('withdrawAccount').value = '';
};

const getAccountInfo = async () => {
  window.bananocoinBananojs.setBananodeApiUrl(config.bananodeUrl);
  const accountInfoElt = document.getElementById('account');
  const account = accountData.account;
  accountInfoElt.innerText = account;
  const accountInfo = await window.bananocoinBananojs.getAccountInfo(account, true);
  // console.log('getAccountInfo', 'accountInfo', accountInfo);
  if (accountInfo.error !== undefined) {
    accountInfoElt.innerText += '\n';
    accountInfoElt.innerText += accountInfo.error;
  } else {
    const balanceParts = await window.bananocoinBananojs.getBananoPartsFromRaw(accountInfo.balance);
    const balanceDescription = await window.bananocoinBananojs.getBananoPartsDescription(balanceParts);
    accountInfoElt.innerText += '\nBalance ' + balanceDescription;

    if (balanceParts.raw == '0') {
      delete balanceParts.raw;
    }

    const bananoDecimal = await window.bananocoinBananojs.getBananoPartsAsDecimal(balanceParts);
    const withdrawAmountElt = document.getElementById('withdrawAmount');
    withdrawAmountElt.value = bananoDecimal;
    const withdrawAccountElt = document.getElementById('withdrawAccount');
    withdrawAccountElt.value = account;
  }
  // console.log('banano checkpending accountData', account);

  const pendingResponse = await window.bananocoinBananojs.getAccountsPending([account], MAX_PENDING, true);
  // console.log('banano checkpending pendingResponse', pendingResponse);
  accountInfoElt.innerText += '\n';
  accountInfoElt.innerText += JSON.stringify(pendingResponse);
  const pendingBlocks = pendingResponse.blocks[account];

  if (pendingBlocks !== undefined) {
    const hashes = [...Object.keys(pendingBlocks)];
    if (hashes.length !== 0) {
      const specificPendingBlockHash = hashes[0];

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

      console.log('banano checkpending account', account);
      console.log('banano checkpending accountSigner', accountSigner);
      console.log('banano checkpending representative', representative);
      console.log('banano checkpending specificPendingBlockHash', specificPendingBlockHash);

      const receiveResponse = await depositUtil.receive(loggingUtil, bananodeApi, account, accountSigner, representative, specificPendingBlockHash, config.prefix);

      accountInfoElt.innerText += '\n';
      accountInfoElt.innerText += JSON.stringify(receiveResponse);
    }
  }
};

window.checkLedgerOrError = async () => {
  clearAccountInfo();
  window.bananocoinBananojs.setBananodeApiUrl(config.bananodeUrl);
  const TransportWebUSB = window.TransportWebUSB;
  const isSupportedFlag = await TransportWebUSB.isSupported();
  console.log('connectLedger', 'isSupportedFlag', isSupportedFlag);
  if (isSupportedFlag) {
    accountSigner = await window.bananocoin.bananojsHw.getLedgerAccountSigner(ACCOUNT_INDEX);
    accountData = {
      publicKey: accountSigner.getPublicKey(),
      account: accountSigner.getAccount(),
    };
    // console.log('connectLedger', 'accountData', accountData);
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

// from https://github.com/bradyjoslin/webcrypto-example/blob/master/script.js
const enc = new TextEncoder();
const dec = new TextDecoder();

const getPasswordKey = (password) => {
  return window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
  );
};

const deriveKey = (passwordKey, salt, keyUsage) => {
  return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 250000,
        hash: 'SHA-256',
      },
      passwordKey,
      {name: 'AES-GCM', length: 256},
      false,
      keyUsage,
  );
};

const encryptData = async (secretData, password) => {
  // console.log('encryptData', 'secretData', secretData);
  // console.log('encryptData', 'password', password);
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const passwordKey = await getPasswordKey(password);
  const aesKey = await deriveKey(passwordKey, salt, ['encrypt']);
  const encryptedContent = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      aesKey,
      new TextEncoder().encode(secretData),
  );

  const encryptedContentArr = new Uint8Array(encryptedContent);
  const buff = new Uint8Array(
      salt.byteLength + iv.byteLength + encryptedContentArr.byteLength,
  );
  buff.set(salt, 0);
  buff.set(iv, salt.byteLength);
  buff.set(encryptedContentArr, salt.byteLength + iv.byteLength);
  const base64Buff = bufferToBase64(buff);
  // console.log('encryptData', 'base64Buff', base64Buff);
  return base64Buff;
};

const bufferToBase64 = (buff) => {
  return btoa(String.fromCharCode.apply(null, buff));
};

const base64ToBuffer = (b64) => {
  if (b64 == undefined) {
    throw Error('b64 is required');
  }
  // console.log('base64ToBuffer', 'b64', b64);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(null));
};

const decryptData = async (encryptedData, password) => {
  if (encryptedData == undefined) {
    throw Error('encryptedData is required');
  }
  if (password == undefined) {
    throw Error('password is required');
  }
  const encryptedDataBuff = base64ToBuffer(encryptedData);
  const salt = encryptedDataBuff.slice(0, 16);
  const iv = encryptedDataBuff.slice(16, 16 + 12);
  const data = encryptedDataBuff.slice(16 + 12);
  const passwordKey = await getPasswordKey(password);
  const aesKey = await deriveKey(passwordKey, salt, ['decrypt']);
  let decryptedContent;
  try {
    decryptedContent = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        aesKey,
        data,
    );
  } catch (error) {
    throw Error('password failed to decrypt seed');
  }
  // console.log('decryptData', 'decryptedContent', decryptedContent);
  return dec.decode(decryptedContent);
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

window.checkOldSeed = async () => {
  clearAccountInfo();
  const encryptedSeed = window.localStorage.getItem('encryptedSeed');
  if (encryptedSeed == undefined) {
    alert('no seed found in local storage');
  } else {
    const oldSeedPassword = document.getElementById('oldSeedPassword').value;
    console.log('checkOldSeed', 'encryptedSeed', encryptedSeed);
    console.log('checkOldSeed', 'oldSeedPassword', oldSeedPassword);
    try {
      unencryptedSeed = await decryptData(encryptedSeed, oldSeedPassword);
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
  const encryptedSeed = await encryptData(newSeed, newSeedPassword);
  window.localStorage.setItem('encryptedSeed', encryptedSeed);
  console.log('checkNewSeed', 'encryptedSeed', encryptedSeed);
  console.log('checkNewSeed', 'localStorage.encryptedSeed', window.localStorage.getItem('encryptedSeed'));
  unencryptedSeed = await decryptData(encryptedSeed, newSeedPassword);
  console.log('checkNewSeed', 'unencryptedSeed', unencryptedSeed);
  // alert(unencryptedSeed);
  await setAccountSignerDataFromSeed(unencryptedSeed);
};
