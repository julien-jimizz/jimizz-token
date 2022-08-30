const { expect } = require("chai");
const { ethers } = require("hardhat");
const { splitSignature } = require('ethers/lib/utils');
const { constants } = require("ethers");

async function getPermitSignature(
    wallet,
    token,
    spender,
    value,
) {
  const nonce = await token.nonces(wallet.address);
  const name = await token.name();
  const version = "1";
  const chainId = await wallet.getChainId();

  return splitSignature(
      await wallet._signTypedData(
          {
            name,
            version,
            chainId,
            verifyingContract: token.address,
          },
          {
            Permit: [
              {
                name: 'owner',
                type: 'address',
              },
              {
                name: 'spender',
                type: 'address',
              },
              {
                name: 'value',
                type: 'uint256',
              },
              {
                name: 'nonce',
                type: 'uint256',
              },
              {
                name: 'deadline',
                type: 'uint256',
              },
            ],
          },
          {
            owner: wallet.address,
            spender,
            value,
            nonce,
            deadline: constants.MaxUint256,
          }
      )
  )
}

describe("Gateway contract", () => {
  let jimizz;
  let distributor;
  let gateway;
  let owner;
  let accounts;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const deployGateway = async () => {
    const Gateway = await ethers.getContractFactory("Gateway");
    gateway = await Gateway.deploy(jimizz.address, distributor.address);
  }

  before(async () => {
    await ethers.provider.send("hardhat_reset");
  });

  beforeEach(async () => {
    [owner, ...accounts] = await ethers.getSigners();

    const Jimizz = await ethers.getContractFactory("Jimizz");
    jimizz = await Jimizz.deploy();

    const FeesDistributor = await ethers.getContractFactory("FeesDistributor");
    distributor = await FeesDistributor.deploy(jimizz.address, accounts[9].address);
    await distributor.addService("Gateway");

    await deployGateway();
  });

  describe("Deployment", () => {
    it("should set the right owner", async () => {
      expect(await gateway.owner()).to.equal(owner.address);
    });

    it("should set the right fees distributor", async () => {
      expect(await gateway.feesDistributor()).to.equal(distributor.address);
    });
  });

  describe("Fees Distributor", () => {
    it("should fail if caller is not the owner", async () => {
      await expect(
        gateway.connect(accounts[1]).changeFeesDistributor(accounts[1].address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
          gateway.changeFeesDistributor(accounts[1].address)
      ).to.be.not.reverted;
    });

    it("should fail if new fees distributor is the zero address", async () => {
      await expect(
          gateway.changeFeesDistributor(ZERO_ADDRESS)
      ).to.be.revertedWith("FeesDistributor address is not valid");
    });

    it("Should revert if the new fees distributor is the same as the current one", async () => {
      await expect(
          gateway.changeFeesDistributor(distributor.address)
      ).to.be.revertedWith("Fees distributor cannot be the same as the old one");

      const Distributor = await ethers.getContractFactory("FeesDistributor");
      const d = await Distributor.deploy(jimizz.address, accounts[9].address);
      await expect(
          gateway.changeFeesDistributor(d.address)
      ).to.be.not.reverted

      await expect(
          gateway.changeFeesDistributor(d.address)
      ).to.be.revertedWith("Fees distributor cannot be the same as the old one");
    });
  });

  describe("Adding merchants", () => {
    it("should revert if caller is not the owner", async () => {
      await expect(
          gateway.connect(accounts[0]).addMerchant(
              "JETM",
              accounts[1].address,
              0
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert if merchantId is empty", async () => {
      await expect(
          gateway.addMerchant("", accounts[1].address, 0)
      ).to.be.revertedWith("merchantId cannot be empty");
    });

    it("should revert if merchant already exists", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          gateway.addMerchant("JETM", accounts[1].address, 0)
      ).to.be.revertedWith("Merchant already exists");
    });

    it("should revert if beneficiary is empty", async () => {
      await expect(
          gateway.addMerchant("JETM", ZERO_ADDRESS, 0)
      ).to.be.revertedWith("Beneficiary address is not valid");
    });

    it("should revert if fees is greater than 10000", async () => {
      await expect(
          gateway.addMerchant("JETM", accounts[1].address, 10001)
      ).to.be.revertedWith("Fees percentage is not valid");
    });

    it("should allow owner to add a new merchant", async () => {
      await expect(
          gateway.addMerchant(
              "JETM",
              accounts[1].address,
              0
          )
      ).to.be.not.reverted;
    });

    it("Adding merchant should emit MerchantAdded event", async () => {
      let merchantId = 'JETM';
      let beneficiary = accounts[1].address;
      let fees = 0;
      await expect(
        gateway.addMerchant(merchantId, beneficiary, fees)
      ).to.emit(gateway, 'MerchantAdded')
          .withArgs(merchantId, beneficiary, fees);

      merchantId = 'SWAME';
      beneficiary = accounts[2].address;
      fees = 1000;
      await expect(
          gateway.addMerchant(merchantId, beneficiary, fees)
      ).to.emit(gateway, 'MerchantAdded')
          .withArgs(merchantId, beneficiary, fees);
    });
  });

  describe("Changing merchant status", () => {
    it("should revert if caller is not the owner", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          gateway.connect(accounts[1]).changeMerchantStatus("JETM", false)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(
          gateway.connect(accounts[1]).changeMerchantStatus("JETM", false)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert if merchant does not exist", async () => {
      await expect(
          gateway.changeMerchantStatus("JETM", false)
      ).to.be.revertedWith("Merchant does not exist");
      await expect(
          gateway.changeMerchantStatus("JETM", false)
      ).to.be.revertedWith("Merchant does not exist");
    });

    it("should revert if given status is the current one", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          gateway.changeMerchantStatus("JETM", true)
      ).to.be.revertedWith("Merchant status is already set to this value");

      await expect(
          gateway.changeMerchantStatus("JETM", false)
      ).to.be.not.reverted;

      await expect(
          gateway.changeMerchantStatus("JETM", false)
      ).to.be.revertedWith("Merchant status is already set to this value");
    });

    it("should emit MerchantStatusChanged event", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          gateway.changeMerchantStatus("JETM", false)
      ).to.emit(gateway, 'MerchantStatusChanged')
          .withArgs('JETM', false);
      await expect(
          gateway.changeMerchantStatus("JETM", true)
      ).to.emit(gateway, 'MerchantStatusChanged')
          .withArgs('JETM', true);
    });
  });

  describe("Changing merchant beneficiary", () => {
    it("should revert if caller is not the owner, nor the current beneficiary", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          gateway.connect(accounts[2]).changeMerchantBeneficiary("JETM", accounts[2].address)
      ).to.be.revertedWith("Caller is not the merchant beneficiary, nor the owner");
      await expect(
          gateway.connect(accounts[3]).changeMerchantBeneficiary("JETM", accounts[2].address)
      ).to.be.revertedWith("Caller is not the merchant beneficiary, nor the owner");


      await expect(
          gateway.changeMerchantBeneficiary("JETM", accounts[2].address)
      ).to.be.not.reverted;
      await expect(
          gateway.connect(accounts[2]).changeMerchantBeneficiary("JETM", accounts[1].address)
      ).to.be.not.reverted;
    });

    it("should revert if merchant does not exist", async () => {
      await expect(
          gateway.changeMerchantBeneficiary("JETM", accounts[2].address)
      ).to.be.revertedWith("Merchant does not exist");
      await expect(
          gateway.changeMerchantBeneficiary("JETM", accounts[2].address)
      ).to.be.revertedWith("Merchant does not exist");
    });

    it("should revert if beneficiary is not valid", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          gateway.changeMerchantBeneficiary("JETM", ZERO_ADDRESS)
      ).to.be.revertedWith("Beneficiary address is not valid");
    });

    it("should revert if given beneficiary is the current one", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          gateway.changeMerchantBeneficiary("JETM", accounts[1].address)
      ).to.be.revertedWith("Merchant beneficiary is already set to this value");

      await expect(
          gateway.changeMerchantBeneficiary("JETM", accounts[2].address)
      ).to.be.not.reverted;

      await expect(
          gateway.changeMerchantBeneficiary("JETM", accounts[2].address)
      ).to.be.revertedWith("Merchant beneficiary is already set to this value");
    });

    it("should emit MerchantBeneficiaryChanged event", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          gateway.changeMerchantBeneficiary("JETM", accounts[2].address)
      ).to.emit(gateway, 'MerchantBeneficiaryChanged')
          .withArgs('JETM', accounts[1].address, accounts[2].address);
      await expect(
          gateway.changeMerchantBeneficiary("JETM", accounts[1].address)
      ).to.emit(gateway, 'MerchantBeneficiaryChanged')
          .withArgs('JETM', accounts[2].address, accounts[1].address);
    });
  });

  describe("Changing merchant fees percentage", () => {
    it("should revert if caller is not the owner", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          gateway.connect(accounts[1]).changeMerchantFeesPercentage("JETM", 1000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(
          gateway.connect(accounts[1]).changeMerchantFeesPercentage("JETM", 1000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert if merchant does not exist", async () => {
      await expect(
          gateway.changeMerchantFeesPercentage("JETM", 1000)
      ).to.be.revertedWith("Merchant does not exist");
    });

    it("should revert if given status is the current one", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          gateway.changeMerchantFeesPercentage("JETM", 0)
      ).to.be.revertedWith("Merchant fees percentage is already set to this value");

      await expect(
          gateway.changeMerchantFeesPercentage("JETM", 1000)
      ).to.be.not.reverted;

      await expect(
          gateway.changeMerchantFeesPercentage("JETM", 1000)
      ).to.be.revertedWith("Merchant fees percentage is already set to this value");
    });

    it("should emit MerchantFeesPercentageChanged event", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          gateway.changeMerchantFeesPercentage("JETM", 1000)
      ).to.emit(gateway, 'MerchantFeesPercentageChanged')
          .withArgs('JETM', 0, 1000);
      await expect(
          gateway.changeMerchantFeesPercentage("JETM", 2000)
      ).to.emit(gateway, 'MerchantFeesPercentageChanged')
          .withArgs('JETM', 1000, 2000);
    });
  });

  describe("Payment & Transactions", () => {
    const give = async (recipient, amount) => {
      await jimizz.transfer(recipient, amount);
    };

    const permitAndPay = async (merchantId, transactionId, spender, amount, fail) => {
      amount = ethers.utils.parseEther(amount);
      const permit = await getPermitSignature(
          spender,
          jimizz,
          fail === true ? ZERO_ADDRESS : gateway.address,
          amount
      );
      return await gateway.pay(
          merchantId,
          transactionId,
          amount,
          spender.address,
          constants.MaxUint256,
          permit.v,
          permit.r,
          permit.s
      );
    }

    const fullPayTest = async (merchantId, feesPercentage, transactionId, spender, amount) => {
      await gateway.addMerchant(merchantId, accounts[1].address, feesPercentage);
      await give(spender.address, ethers.utils.parseEther(amount));
      return permitAndPay("JETM", transactionId, spender, amount);
    };

    it("should revert if merchant does not exist", async () => {
      await expect(
          permitAndPay("JETM", 1, accounts[2], "100")
      ).to.be.revertedWith("Merchant does not exist");
    });

    it("should revert if merchant is not enabled", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await gateway.changeMerchantStatus("JETM", false);
      await expect(
          permitAndPay("JETM", 1, accounts[2], "100")
      ).to.be.revertedWith("Merchant is disabled");
    });

    it("should revert if permit signature is not valid", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          permitAndPay("JETM", 1, accounts[2], "100", true)
      ).to.be.revertedWith("ERC20Permit: invalid signature");
    });

    it("should revert if user has not enough balance", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await expect(
          permitAndPay("JETM", 1, accounts[2], "100")
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("should send funds to the merchant beneficiary", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);

      const amount = "100";
      await give(accounts[2].address, ethers.utils.parseEther(amount));

      await expect(
          permitAndPay("JETM", 1, accounts[2], amount)
      ).to.be.not.reverted;

      const balance = await jimizz.balanceOf(accounts[1].address);
      expect(balance).to.eq(ethers.utils.parseEther(amount));
    });

    it("should emit PaymentMade event", async () => {
      await expect(
          fullPayTest("JETM", 0, 1, accounts[2], "100")
      ).to.emit(gateway, 'PaymentMade');
    });

    it("getTransaction should return the transaction", async () => {
      const merchantId = "JETM";
      const transactionId = "1";
      const spender = accounts[2];
      const amount = "100";
      const feesPercentage = 1000; // 10%
      await fullPayTest(merchantId, feesPercentage, transactionId, spender, amount);
      const transaction = await gateway.getTransaction(merchantId, transactionId);
      expect(transaction).to.not.be.null;
      expect(transaction.merchantId).to.eq(merchantId);
      expect(transaction.id).to.eq(transactionId);
      expect(transaction.payer).to.eq(spender.address);
      expect(transaction.amount).to.eq(ethers.utils.parseEther(amount));

      const fees = ethers.utils.parseEther(amount).mul(feesPercentage).div(10000);
      expect(transaction.fees).to.eq(fees);
    });

    it("getTransaction should revert if merchant does not exist", async () => {
      await expect(
          gateway.getTransaction("JETM", "1")
      ).to.be.revertedWith("Merchant does not exist");
    });

    it("getTransaction should return empty transaction if transaction has not been paid", async () => {
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      const transaction = await gateway.getTransaction("JETM", "1");
      expect(transaction.id).to.be.empty;
      expect(transaction.merchantId).to.be.empty;
      expect(transaction.date).to.be.eq(0);
      expect(transaction.amount).to.be.eq(0);
      expect(transaction.fees).to.be.eq(0);
      expect(transaction.payer).to.be.eq(ZERO_ADDRESS);

    });

    it("should revert if the transaction has already been paid", async () => {
      const merchantId = "JETM";
      const transactionId = "1";
      const spender = accounts[2];
      const amount = "100";
      await fullPayTest(merchantId, 0, transactionId, spender, amount);
      await give(spender.address, ethers.utils.parseEther(amount));
      await expect(
          permitAndPay(merchantId, transactionId, spender, amount)
      ).to.be.revertedWith("This transaction has already been paid");
    });

    it("should be possible to filter PaymentMade events by merchantId", async () => {
      const payers = accounts.slice(2);

      // Create merchants
      await gateway.addMerchant("JETM", accounts[1].address, 0);
      await gateway.addMerchant("SWAME", accounts[2].address, 1000);

      // Random payments
      for (let transactionId = 1; transactionId <= 10; transactionId++) {
        const spender = payers[Math.floor(Math.random() * payers.length)];
        const amount = Math.ceil(Math.random() * 1000).toString();
        await give(spender.address, ethers.utils.parseEther(amount));
        await permitAndPay(
            transactionId % 2 ? "JETM" : "SWAME",
            transactionId.toString(),
            spender,
            amount
        );
      }

      // Check events
      const jetmFilter = gateway.filters.PaymentMade("JETM");
      const jetmTxs = await gateway.queryFilter(jetmFilter);
      expect(jetmTxs.length).to.eq(5);
      expect(
          jetmTxs
              .filter(tx => tx.args.transaction.merchantId === "JETM")
              .length
      ).to.eq(jetmTxs.length);

      const swameFilter = gateway.filters.PaymentMade("SWAME");
      const swameTxs = await gateway.queryFilter(swameFilter);
      expect(swameTxs.length).to.eq(5);
      expect(
          swameTxs
              .filter(tx => tx.args.transaction.merchantId === "SWAME")
              .length
      ).to.eq(swameTxs.length);
    });
  });
});
