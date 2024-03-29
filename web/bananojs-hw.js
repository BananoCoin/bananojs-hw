// begin hacks thaat make require() work.
window.bananocoin.other['@bananocoin/bananojs'] = window.bananocoinBananojs;
window.bananocoin.other['hw-app-nano'] = window.BananoHwApp;
window.bananocoin.other['@ledgerhq/hw-transport-node-hid'] =
  window.TransportWebUSB;
// end hacks thaat make require() work.
if (window.bananocoin.bananojsHw === undefined) {
  window.bananocoin.bananojsHw = {};
}
window.bananocoin.bananojsHw.getLedgerAccountData = async (index) => {
  // https://github.com/BananoCoin/bananovault/blob/master/src/app/services/ledger.service.ts#L128
  const getLedgerPath = window.bananocoinBananojsHw.getLedgerPath;

  const BananoHwApp = window.BananoHwApp;
  const TransportWebUSB = window.TransportWebUSB;
  const transport = await TransportWebUSB.create();
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
};

window.bananocoin.bananojsHw.getLedgerAccountSigner = async (accountIx) => {
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
  const transport = await TransportWebUSB.create();
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
};
