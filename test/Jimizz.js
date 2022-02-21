const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Jimizz contract", () => {
  let jimizz;
  let owner;
  let accounts;

  before(async () => {
    const Jimizz = await ethers.getContractFactory("Jimizz");
    [owner, ...accounts] = await ethers.getSigners();

    jimizz = await Jimizz.deploy();
  });

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      expect(await jimizz.owner()).to.equal(owner.address);
    });

    it("Should assign the total supply to the owner", async () => {
      const totalSupply = await jimizz.totalSupply();
      const ownerBalance = await jimizz.balanceOf(owner.address);
      expect(totalSupply).to.equal(ownerBalance);
    });
  });

  describe("Transactions", () => {
    it("Should transfer tokens between accounts", async () => {
      // Transfer 50 tokens from owner to accounts[0]
      await jimizz.transfer(accounts[0].address, 50);
      const acc0Balance = await jimizz.balanceOf(accounts[0].address);
      expect(acc0Balance).to.equal(50);

      // Transfer 50 tokens from accounts[0] to accounts[1]
      await jimizz.connect(accounts[0]).transfer(accounts[1].address, 50);
      const acc1Balance = await jimizz.balanceOf(accounts[1].address);
      expect(acc1Balance).to.equal(50);
    });

    it("Should fail if sender doesn't have enough tokens", async () => {
      const initialOwnerBalance = await jimizz.balanceOf(owner.address);

      await expect(
        jimizz.connect(accounts[0]).transfer(owner.address, 1)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      // Owner balance shouldn't have changed
      expect(await jimizz.balanceOf(owner.address)).to.equal(
        initialOwnerBalance
      );
    });

    it("Should update balances after transfers", async () => {
      const initialOwnerBalance = await jimizz.balanceOf(owner.address);

      // Transfer 100 tokens from owner to accounts[0].
      await jimizz.transfer(accounts[8].address, 100);

      // Transfer another 50 tokens from owner to accounts[1].
      await jimizz.transfer(accounts[9].address, 50);

      // Check balances.
      const finalOwnerBalance = await jimizz.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance.sub(150));

      const acc8Balance = await jimizz.balanceOf(accounts[8].address);
      expect(acc8Balance).to.equal(100);

      const acc9Balance = await jimizz.balanceOf(accounts[9].address);
      expect(acc9Balance).to.equal(50);
    });
  });
});
