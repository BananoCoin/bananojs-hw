// begin hacks thaat make require() work.
window.bananocoin.other['@bananocoin/bananojs'] = window.bananocoinBananojs;
window.bananocoin.other['@bananocoin/bananojs-hw'] = window.bananocoinBananojsHw;
window.bananocoin.other['hw-app-nano'] = window.BananoHwApp;
window.bananocoin.other['@ledgerhq/hw-transport-node-hid'] =
  window.TransportWebUSB;
if (window.bananocoin.bananojsHw === undefined) {
  window.bananocoin.bananojsHw = {};
}

let _webUSBSupported = undefined;
const webUSBSupported = async () => {
  if (_webUSBSupported === undefined) {
    try {
      _webUSBSupported = await window.TransportWebUSB?.isSupported();
    } catch(error) {
      console.error('unexpected error while calling TransportWebUSB.isSupported()', error.message);
    }
  }

  return _webUSBSupported;
};

const getLedgerAccountDataUsingWebUSB = async (index) => {
  // https://github.com/BananoCoin/bananovault/blob/master/src/app/services/ledger.service.ts#L128
  const getLedgerPath = window.bananocoinBananojsHw.getLedgerPath;

  const BananoHwApp = window.BananoHwApp;
  const TransportWebUSB = window.TransportWebUSB;
  let transport;
  try {
    transport = await TransportWebUSB.create();
  } catch(error) {
    return undefined;
  }
  
  // console.log('getLedgerAccountData', 'transport', transport);
  try {
    const banHwAppInst = new BananoHwApp(transport);
    // console.log('getLedgerAccountData', 'banHwAppInst', banHwAppInst);
    const ledgerPath = getLedgerPath(index);
    // console.log('getLedgerAccountData', 'ledgerPath', ledgerPath);
    const accountData = await banHwAppInst.getAddress(ledgerPath);
    console.log('getLedgerAccountData', 'accountData', accountData);
    accountData.account = accountData.address;
    delete accountData.address;
    return accountData;
  } finally {
    await transport.close();
  }
}

const getLedgerAccountDataUsingU2F = async (index) => {
  try {
    const ledgerPath = window.bananocoinBananojsHw.getLedgerPath(index);
    console.log(`getLedgerPath return: ${ledgerPath}`);
    return await window.u2fInst.getAddress(ledgerPath);
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

// WebUSB or U2F ready
window.bananocoin.bananojsHw.onUsbReady = async (callback) => {
  const BananoHwApp = window.BananoHwApp;
  let webUsbSupported = false;
  try {
    webUsbSupported = await webUSBSupported();
  } catch(error) {
    console.error(`unexpected error while checking webUSBSupported`);
  }
  if (webUsbSupported) {
    callback();
  } else {
    /** https://github.com/Nault/Nault/blob/cd6d388e60ce84affaa813991445734cdf64c49f/src/app/services/ledger.service.ts#L268 */
    /** Creates alternative method for reading from USB, used in Firefox. Legacy technology; desperately want to remove this but people keep asking for Firefox support. */
    const u2fPromise = new Promise((resolve, reject) => {
      window.TransportU2F.create()
        .then((trans) => {
          const uf2Instance = new BananoHwApp(trans);
          window.u2fInst = uf2Instance;
          resolve();
        })
        .catch(reject);
    });

    try {
      await u2fPromise;
      callback();
    } catch(error) {
      console.log(`neither webUSB or u2f is available for initiating usb connection`);
    }
  }
}

// Note that the returned account data is different from WebUSB and U2F.
// For some reason, accountData.address is renamed to accountData.account in getLedgerAccountDataUsingWebUSB in this file and index.js.
window.bananocoin.bananojsHw.getLedgerAccountData = async (index) => {
  let webUsbSupported = false;
  try {
    webUsbSupported = await webUSBSupported();
  } catch(error) {
    console.error(`unexpected error while calling webUSBSupported`);
  }

  if (webUsbSupported) {
    try {
      return await getLedgerAccountDataUsingWebUSB(index);
    } catch(error) {
      console.error('unexpected error while calling getLedgerAccountDataUsingWebUSB', error);
    }
    
  } else if (window.u2fInst) {
    try {
      return await getLedgerAccountDataUsingU2F(index);
    } catch(error) {
      console.error('unexpected error while calling getLedgerAccountDataUsingU2F', error);
    }
  } else {
    console.log('neither webUSB or u2f is available for getting account data');
  }
};

window.bananocoin.bananojsHw.getLedgerAddressFromIndex = async (index) => {
  let accountData;

  try {
    accountData = await window.bananocoin.bananojsHw.getLedgerAccountData(index);
  } catch (error) {
    console.error('error from getLedgerAddressFromIndex', error.message);
    return undefined;
  }

  const webUsbSupported = await webUSBSupported();
  if (webUsbSupported && accountData?.account) {
    return accountData.account;
  }

  if (window.u2fInst && accountData?.address) {
    return accountData.address;
  }
}

window.bananocoin.bananojsHw.getLedgerAccountSigner = async (accountIx) => {
  const config = window.bananocoinBananojsHw.bananoConfig;
  /* istanbul ignore if */
  if (config === undefined) {
    throw Error('config is a required parameter.');
  }
  /* istanbul ignore if */
  if (accountIx === undefined) {
    throw Error('accountIx is a required parameter.');
  }

  const webUsbSupported = await webUSBSupported();
  if (webUsbSupported) {
    return createSignerUsingWebUSB(accountIx);
  }

  if (window.u2fInst) {
    return createSignerUsingU2F(accountIx);
  }
};

const createSignerUsingWebUSB = async (accountIx) => {
  const config = window.bananocoinBananojsHw.bananoConfig;
  const getLedgerPath = window.bananocoinBananojsHw.getLedgerPath;
  const bananodeApi = window.bananocoinBananojs.bananodeApi;

  const BananoHwApp = window.BananoHwApp;
  const TransportWebUSB = window.TransportWebUSB;

  /* istanbul ignore if */
  if (config === undefined) {
    throw Error('config is a required parameter.');
  }
  /* istanbul ignore if */
  if (accountIx === undefined) {
    throw Error('accountIx is a required parameter.');
  }
  // https://github.com/BananoCoin/bananovault/blob/master/src/app/services/ledger.service.ts#L379
  let transport;
  try {
    transport = await TransportWebUSB.create();
  } catch(error) {
    console.error('unexpected error while calling TransportWebUSB.create()', error.message);
    return undefined;
  }
  let accountData;
  try {
    const banHwAppInst = new BananoHwApp(transport);
    const ledgerPath = getLedgerPath(accountIx);
    accountData = await banHwAppInst.getAddress(ledgerPath);
  } finally {
    await transport.close();
  }
  const signer = {};
  signer.getPublicKey = () => {
    return accountData.publicKey;
  };
  signer.getAccount = () => {
    return accountData.address;
  };
  signer.signBlock = async (blockData) => {
    const transport = await TransportWebUSB.create();
    try {
      const banHwAppInst = new BananoHwApp(transport);
      const ledgerPath = getLedgerPath(accountIx);

      // console.log('signer.signBlock', 'blockData', blockData);
      const hwBlockData = {};
      if (
        blockData.previous ==
        '0000000000000000000000000000000000000000000000000000000000000000'
      ) {
        hwBlockData.representative = blockData.representative;
        hwBlockData.balance = blockData.balance;
        hwBlockData.sourceBlock = blockData.link;
      } else {
        hwBlockData.previousBlock = blockData.previous;
        hwBlockData.representative = blockData.representative;
        hwBlockData.balance = blockData.balance;
        hwBlockData.recipient = window.bananocoinBananojs.getBananoAccount(
          blockData.link,
        );

        const cacheBlockData = {};
        const cacheBlocks = await bananodeApi.getBlocks(
          [blockData.previous],
          true,
        );
        // console.log('signer.signBlock', 'cacheBlocks', cacheBlocks);
        const cacheBlock = cacheBlocks.blocks[blockData.previous];
        // console.log('signer.signBlock', 'cacheBlock', cacheBlock);
        cacheBlockData.previousBlock = cacheBlock.previous;
        cacheBlockData.representative = cacheBlock.representative;
        cacheBlockData.balance = cacheBlock.balance;
        cacheBlockData.recipient = window.bananocoinBananojs.getBananoAccount(
          cacheBlock.link,
        );
        // console.log('signer.signBlock', 'cacheBlockData', cacheBlockData);
        try {
          // const cacheResponse =
          await banHwAppInst.cacheBlock(
            ledgerPath,
            cacheBlockData,
            cacheBlock.signature,
          );
          // console.log('signer.signBlock', 'cacheResponse', cacheResponse);
        } catch (error) {
          console.log('signer.signBlock', 'error', error.message);
          console.trace(error);
        }
      }

      // console.log('signer.signBlock', 'hwBlockData', hwBlockData);
      return await banHwAppInst.signBlock(ledgerPath, hwBlockData);
    } finally {
      await transport.close();
    }
  };
  return signer;
}

const createSignerUsingU2F = async (accountIx) => {
  console.log(`createSignerUsingU2F`);
  const getLedgerPath = window.bananocoinBananojsHw.getLedgerPath;
  const bananodeApi = window.bananocoinBananojs.bananodeApi;

  const ledgerPath = getLedgerPath(accountIx);
  let accountData = undefined;
  try {
    accountData = await getLedgerAccountDataUsingU2F(ledgerPath);
  } catch(error) {
    console.error('unexpected error while calling getLedgerAccountDataUsingU2F', error.message);
    return undefined;
  }

  const signer = {};
  signer.getPublicKey = () => {
    return accountData.publicKey;
  };
  signer.getAccount = () => {
    return accountData.address;
  };
  signer.signBlock = async (blockData) => {
    try {
      // console.log('signer.signBlock', 'blockData', blockData);
      const hwBlockData = {};
      if (blockData.previous == '0000000000000000000000000000000000000000000000000000000000000000') {
        hwBlockData.representative = blockData.representative;
        hwBlockData.balance = blockData.balance;
        hwBlockData.sourceBlock = blockData.link;
      } else {
        hwBlockData.previousBlock = blockData.previous;
        hwBlockData.representative = blockData.representative;
        hwBlockData.balance = blockData.balance;
        hwBlockData.recipient = window.bananocoinBananojs.getBananoAccount(blockData.link);

        const cacheBlockData = {};
        const cacheBlocks = await bananodeApi.getBlocks([blockData.previous], true);
        // console.log('signer.signBlock', 'cacheBlocks', cacheBlocks);
        const cacheBlock = cacheBlocks.blocks[blockData.previous];
        // console.log('signer.signBlock', 'cacheBlock', cacheBlock);
        cacheBlockData.previousBlock = cacheBlock.previous;
        cacheBlockData.representative = cacheBlock.representative;
        cacheBlockData.balance = cacheBlock.balance;
        cacheBlockData.recipient = window.bananocoinBananojs.getBananoAccount(cacheBlock.link);
        // console.log('signer.signBlock', 'cacheBlockData', cacheBlockData);
        try {
          // const cacheResponse =
          await window.u2fInst.cacheBlock(
            ledgerPath,
            cacheBlockData,
            cacheBlock.signature
          );
          // console.log('signer.signBlock', 'cacheResponse', cacheResponse);
        } catch (error) {
          console.log('signer.signBlock', 'error', error.message);
          console.trace(error);
        }
      }

      console.log('signer.signBlock', 'hwBlockData', hwBlockData);
      const results = await window.u2fInst.signBlock(
        ledgerPath,
        hwBlockData
      );

      return results;
    } finally {
      // .....
    }
  };
  return signer;
};
