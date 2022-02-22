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
      const amount = ethers.utils.parseEther('50');

      // Transfer 50 tokens from owner to accounts[0]
      await jimizz.transfer(accounts[0].address, amount);
      const acc0Balance = await jimizz.balanceOf(accounts[0].address);
      expect(acc0Balance).to.eq(amount);

      // Transfer 50 tokens from accounts[0] to accounts[1]
      await jimizz.connect(accounts[0]).transfer(accounts[1].address, amount);
      const acc1Balance = await jimizz.balanceOf(accounts[1].address);
      expect(acc1Balance).to.eq(amount);
    });

    it("Should fail if sender doesn't have enough tokens", async () => {
      const initialOwnerBalance = await jimizz.balanceOf(owner.address);

      await expect(
        jimizz.connect(accounts[0]).transfer(owner.address, 1)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      // Owner balance shouldn't have changed
      expect(await jimizz.balanceOf(owner.address)).to.eq(
        initialOwnerBalance
      );
    });

    it("Should update balances after transfers", async () => {
      const initialOwnerBalance = await jimizz.balanceOf(owner.address);
      const amount1 = ethers.utils.parseEther('100');
      const amount2 = ethers.utils.parseEther('50');

      // Transfer 100 tokens from owner to accounts[0]
      await jimizz.transfer(accounts[8].address, amount1);

      // Transfer another 50 tokens from owner to accounts[1]
      await jimizz.transfer(accounts[9].address, amount2);

      // Check balances
      const finalOwnerBalance = await jimizz.balanceOf(owner.address);
      expect(finalOwnerBalance).to.eq(
        initialOwnerBalance
          .sub(amount1)
          .sub(amount2)
      );

      const acc8Balance = await jimizz.balanceOf(accounts[8].address);
      expect(acc8Balance).to.eq(amount1);

      const acc9Balance = await jimizz.balanceOf(accounts[9].address);
      expect(acc9Balance).to.eq(amount2);
    });

    it("should be able to drain ERC20", async () => {
      const amount = ethers.utils.parseEther('15000');

      const ownerInitialBalance = await jimizz.balanceOf(owner.address);

      // Send some token on the jimizz contract
      await jimizz.transfer(jimizz.address, amount);
      const ownerBalance = await jimizz.balanceOf(owner.address);
      expect(ownerBalance).to.eq(
        ownerInitialBalance
          .sub(amount)
      );

      // Jimizz contract balance should have changed
      const jimizzBalance = await jimizz.balanceOf(jimizz.address);
      expect(jimizzBalance).to.eq(amount);

      // Drain ERC20
      await jimizz.drainERC20(jimizz.address);

      // Jimizz contract balance should be 0
      const newJimizzBalance = await jimizz.balanceOf(jimizz.address);
      expect(newJimizzBalance).to.eq(0);

      // Owner should have receive the tokens
      const newOwnerBalance = await jimizz.balanceOf(owner.address);
      expect(newOwnerBalance).to.eq(ownerInitialBalance);
    });
  });
});
