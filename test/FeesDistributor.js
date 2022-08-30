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

describe("FeesDistributor contract", () => {
  let jimizz;
  let distributor;
  let gateway;
  let owner;
  let accounts;
  let charityBeneficiary;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const service = "TEST";
  const percentage = 1000; // 10%

  before(async () => {
    await ethers.provider.send("hardhat_reset");
  });

  beforeEach(async () => {
    [owner, ...accounts] = await ethers.getSigners();

    const Jimizz = await ethers.getContractFactory("Jimizz");
    jimizz = await Jimizz.deploy();

    charityBeneficiary = accounts[9].address;
    const FeesDistributor = await ethers.getContractFactory("FeesDistributor");
    distributor = await FeesDistributor.deploy(jimizz.address, charityBeneficiary);
  });

  describe("Deployment", () => {
    it("should set the right owner", async () => {
      expect(await distributor.owner()).to.equal(owner.address);
    });

    it("should set the right token", async () => {
      expect(await distributor.token()).to.equal(jimizz.address);
    });

    it("should set the right charity beneficiary", async () => {
      expect(await distributor.charityBeneficiary()).to.equal(charityBeneficiary);
    });
  });

  describe("Charity beneficiary setter", () => {
    it("should revert if address is invalid", async () => {
      await expect(
        distributor.setCharityBeneficiary(ZERO_ADDRESS)
      ).to.be.revertedWith("Beneficiary address is not valid");
    });

    it("should revert if address is the same as the old one", async () => {
      await expect(
        distributor.setCharityBeneficiary(accounts[8].address)
      ).to.be.not.reverted;

      await expect(
        distributor.setCharityBeneficiary(accounts[8].address)
      ).to.be.revertedWith("Charity beneficiary cannot be the same as the old one");

      await expect(
        distributor.setCharityBeneficiary(charityBeneficiary)
      ).to.be.not.reverted;
    });

    it("should revert if caller is not the owner nor the current charity beneficiary", async () => {
      await expect(
        distributor
          .connect(owner)
          .setCharityBeneficiary(accounts[8].address)
      ).to.be.not.reverted;

      await expect(
        distributor
          .connect(accounts[8])
          .setCharityBeneficiary(charityBeneficiary)
      ).to.be.not.reverted;

      await expect(
        distributor
          .connect(accounts[8])
          .setCharityBeneficiary(accounts[8].address)
      ).to.be.revertedWith("Caller is not the Charity beneficiary, nor the owner");
    });

    it("should set the new charity beneficiary", async () => {
      distributor.setCharityBeneficiary(accounts[8].address)
      const charityBeneficiary = await distributor.charityBeneficiary();
      expect(charityBeneficiary).to.eq(accounts[8].address);

      distributor.setCharityBeneficiary(charityBeneficiary)
      const charityBeneficiary2 = await distributor.charityBeneficiary();
      expect(charityBeneficiary2).to.eq(charityBeneficiary);
    });

    it("should emit CharityBeneficiaryChanged", async () => {
      await expect(
        distributor.setCharityBeneficiary(accounts[8].address)
      ).to.emit(distributor, "CharityBeneficiaryChanged")
        .withArgs(charityBeneficiary, accounts[8].address);
    });
  });

  describe("Adding services", () => {
    it("should revert if service already exists", async () => {
      await expect(distributor.addService("TEST"))
        .to.be.not.reverted;
      await expect(distributor.addService("TEST2"))
        .to.be.not.reverted;

      await expect(distributor.addService("TEST"))
        .to.be.revertedWith("Service already exists");
      await expect(distributor.addService("TEST2"))
        .to.be.revertedWith("Service already exists");
    });

    it("should emit ServiceAdded event", async () => {
      await expect(
        distributor.addService("TEST")
      ).to.emit(distributor, "ServiceAdded")
        .withArgs("TEST");
    });
  });

  describe("Adding Beneficiaries", () => {
    it("should revert if service does not exists", async () => {
      const add = async () => distributor.updateBeneficiary(
        "UNKNOWN",
        "CLUB69",
        1000,
        accounts[1].address,
        false
      );

      await expect(add()).to.be.revertedWith("Service does not exist");

      await distributor.addService("UNKNOWN");
      await expect(add()).to.be.not.reverted;
    });

    it("should revert if percentage is greater than 10000", async () => {
      await distributor.addService("TEST");
      await expect(
        distributor.updateBeneficiary(
          "TEST",
          "CLUB69",
          10001,
          accounts[1].address,
          false
        )
      ).to.be.revertedWith("Percentage should not exceed 10000");
    });

    it("should revert if beneficiary address is not valid", async () => {
      await distributor.addService("TEST");
      await expect(
        distributor.updateBeneficiary(
          "TEST",
          "CLUB69",
          1000,
          ZERO_ADDRESS,
          false
        )
      ).to.be.revertedWith("Beneficiary address is not valid");
    });

    it("should revert if total service percentage exceeds 100%", async () => {
      await distributor.addService("TEST");

      // Add 90% beneficiary
      await distributor.updateBeneficiary(
        "TEST",
        "ONE",
        9000,
        accounts[1].address,
        false
      );

      // Try to add 10% beneficiary
      await expect(
        distributor.updateBeneficiary(
          "TEST",
          "TWO",
          1000,
          accounts[1].address,
          false
        )
      ).to.be.not.reverted;

      // Try to add 11% beneficiary
      await expect(
        distributor.updateBeneficiary(
          "TEST",
          "TWO",
          1100,
          accounts[1].address,
          false
        )
      ).to.be.revertedWith("The percentage exceeds the remaining percentage on this service. Please review the beneficiary percentages.");
    });

    it("should emit ServiceBeneficiariesUpdated event", async () => {
      const service = "TEST";
      const name = "ONE";
      const percentage = 1000;

      // Add service
      await distributor.addService(service);

      // New beneficiary
      await expect(
        distributor.updateBeneficiary(
          service,
          name,
          percentage,
          accounts[1].address,
          false
        )
      ).to.emit(distributor, "ServiceBeneficiariesUpdated")
        .withArgs(service, name, percentage, accounts[1].address);

      // Update beneficiary
      await expect(
        distributor.updateBeneficiary(
          service,
          name,
          percentage * 2,
          accounts[2].address,
          false
        )
      ).to.emit(distributor, "ServiceBeneficiariesUpdated")
        .withArgs(service, name, percentage * 2, accounts[2].address);
    });
  });

  describe("Distributing", () => {
    it("should distribute fees to service beneficiaries", async () => {
      await distributor.addService(service);

      await distributor.updateBeneficiary(
        service,
        "CLUB69",
        percentage,
        accounts[1].address,
        false
      );

      const percentage2 = 2000;
      await distributor.updateBeneficiary(
        service,
        "XSAVINGS",
        percentage2,
        accounts[2].address,
        false
      );

      // Approve and distribute
      const amount = ethers.utils.parseEther("100");
      await jimizz.approve(distributor.address, amount);
      await distributor.distribute(service, amount);

      const cut1 = amount.mul(percentage).div(10000);
      const balance1 = await jimizz.balanceOf(accounts[1].address);
      expect(balance1).to.be.eq(cut1);

      const cut2 = amount.mul(percentage2).div(10000);
      const balance2 = await jimizz.balanceOf(accounts[2].address);
      expect(balance2).to.be.eq(cut2);
    });

    it("should approve and call beneficiary method", async () => {
      const Receiver = await ethers.getContractFactory("JimizzFeeReceiverMock");
      const receiver = await Receiver.deploy();

      await distributor.addService(service);
      await distributor.updateBeneficiary(
        service,
        "CLUB69",
        percentage,
        receiver.address,
        true
      );

      // Approve and distribute
      const amount = ethers.utils.parseEther("100");
      await jimizz.approve(distributor.address, amount);
      await distributor.distribute(service, amount);

      // Test balance
      const cut = amount.mul(percentage).div(10000);
      const balance = await jimizz.balanceOf(receiver.address);
      expect(balance).to.be.eq(cut);
    });

    it("should emit BeneficiaryContractFailed if beneficiary contract fails", async () => {
      const Receiver = await ethers.getContractFactory("JimizzFeeReceiverFailureMock");
      const receiver = await Receiver.deploy();

      await distributor.addService(service);
      await distributor.updateBeneficiary(
        service,
        "CLUB69",
        percentage,
        receiver.address,
        true
      );

      // Approve and distribute
      const amount = ethers.utils.parseEther("100");
      const cut = amount.mul(percentage).div(10000);
      await jimizz.approve(distributor.address, amount);
      await expect(
        distributor.distribute(service, amount)
      ).to.emit(distributor, "BeneficiaryContractFailed")
        .withArgs("CLUB69", receiver.address, cut);
    });

    it("should not distribute fees to other service beneficiaries", async () => {
      // Add service 1 with one beneficiary
      await distributor.addService("SERVICE_1");
      await distributor.updateBeneficiary("SERVICE_1", "ONE", 1000, accounts[1].address, false);

      // Add service 2 with two other beneficiaries
      await distributor.addService("SERVICE_2");
      await distributor.updateBeneficiary("SERVICE_2", "TWO", 2000, accounts[2].address, false);
      await distributor.updateBeneficiary("SERVICE_2", "THREE", 3000, accounts[3].address, false);

      const distribute100 = async (service) => {
        const amount = ethers.utils.parseEther("100");
        await jimizz.approve(distributor.address, amount);
        await distributor.distribute(service, amount);
      };

      // Distribute for service 1 and check balances
      // One should have received its 10% cut, two and three should have an empty balance
      await distribute100("SERVICE_1");

      const oneBalance = await jimizz.balanceOf(accounts[1].address);
      const twoBalance = await jimizz.balanceOf(accounts[2].address);
      const threeBalance = await jimizz.balanceOf(accounts[3].address);
      expect(oneBalance).to.eq(ethers.utils.parseEther("10"));
      expect(twoBalance).to.eq(ethers.utils.parseEther("0"));
      expect(threeBalance).to.eq(ethers.utils.parseEther("0"));

      // Distribute for service 2 and check balances
      // One should have not received anything, two and three should have received their cut
      await distribute100("SERVICE_2");

      const oneBalance2 = await jimizz.balanceOf(accounts[1].address);
      const twoBalance2 = await jimizz.balanceOf(accounts[2].address);
      const threeBalance2 = await jimizz.balanceOf(accounts[3].address);
      expect(oneBalance2).to.eq(ethers.utils.parseEther("10"));
      expect(twoBalance2).to.eq(ethers.utils.parseEther("20"));
      expect(threeBalance2).to.eq(ethers.utils.parseEther("30"));
    });

    it("should distribute remains to charity", async () => {
      // Service 1 with a 90% beneficiary
      const onePercent = 9000;
      await distributor.addService("SERVICE_1");
      await distributor.updateBeneficiary("SERVICE_1", "ONE", onePercent, accounts[1].address, false);

      // Service 2 with a 25% beneficiary
      const twoPercent = 2500;
      await distributor.addService("SERVICE_2");
      await distributor.updateBeneficiary("SERVICE_2", "TWO", twoPercent, accounts[2].address, false);

      // Distribute through service 1 - Charity should have received 10%
      const amount1 = ethers.utils.parseEther("1000");
      const cut1 = amount1.mul(onePercent).div(10000);
      await jimizz.approve(distributor.address, amount1);
      await distributor.distribute("SERVICE_1", amount1);
      const balance1 = await jimizz.balanceOf(accounts[1].address);
      const charityBalance1 = await jimizz.balanceOf(charityBeneficiary);
      expect(balance1).to.eq(cut1);
      expect(charityBalance1).to.eq(amount1.sub(cut1));

      // Distribute through service 2 - Charity should have received 75%
      const amount2 = ethers.utils.parseEther("1000");
      const cut2 = amount2.mul(twoPercent).div(10000);
      await jimizz.approve(distributor.address, amount2);
      await distributor.distribute("SERVICE_2", amount2);
      const balance2 = await jimizz.balanceOf(accounts[2].address);
      const charityBalance2 = await jimizz.balanceOf(charityBeneficiary);
      expect(balance2).to.eq(cut2);
      expect(charityBalance2).to.eq(amount1.sub(cut1).add(amount2).sub(cut2));
    });

    it("should distribute everything to charity if there is no service beneficiaries", async () => {
      await distributor.addService("SERVICE_1");

      const amount = ethers.utils.parseEther("1000");
      await jimizz.approve(distributor.address, amount);
      await distributor.distribute("SERVICE_1", amount);

      const balance = await jimizz.balanceOf(charityBeneficiary);
      expect(balance).to.eq(amount);
    });

    it("should not distribute anything to charity if there is no remains", async () => {
      await distributor.addService("SERVICE_1");
      await distributor.updateBeneficiary("SERVICE_1", "B10", 1000, accounts[1].address, false);
      await distributor.updateBeneficiary("SERVICE_1", "B20", 2000, accounts[2].address, false);
      await distributor.updateBeneficiary("SERVICE_1", "B30", 3000, accounts[3].address, false);
      await distributor.updateBeneficiary("SERVICE_1", "B40", 4000, accounts[4].address, false);

      const amount = ethers.utils.parseEther("1000");
      await jimizz.approve(distributor.address, amount);
      await distributor.distribute("SERVICE_1", amount);

      const balance = await jimizz.balanceOf(charityBeneficiary);
      expect(balance).to.eq(0);
    });
  });
});
