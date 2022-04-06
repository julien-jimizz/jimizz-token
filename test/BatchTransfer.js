const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BatchTransfer contract", () => {
  let jimizz;
  let batchTransfer;
  let owner;
  let accounts;

  beforeEach(async () => {
    const Jimizz = await ethers.getContractFactory("Jimizz");
    const BatchTransfer = await ethers.getContractFactory("BatchTransfer");
    [owner, ...accounts] = await ethers.getSigners();

    jimizz = await Jimizz.deploy();
    batchTransfer = await BatchTransfer.deploy(jimizz.address);
  });

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      expect(await batchTransfer.owner()).to.equal(owner.address);
    });
  })

  describe("Batch transfers", () => {
    it("should revert if allowance is too low", async () => {
      await expect(
        batchTransfer.batchTransfer(
          [owner.address],
          [ethers.utils.parseEther('1')]
        )).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });

    it("should revert if transfer fails", async () => {
      await expect(
        batchTransfer.connect(accounts[0])
          .batchTransfer(
            [owner.address],
            [ethers.utils.parseEther('1')]
          )).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("should revert if allowance is lower than the sum of amounts", async () => {
      const amount = ethers.utils.parseEther('1000');
      await jimizz.approve(batchTransfer.address, amount);

      await expect(
        batchTransfer
          .batchTransfer(
            [owner.address],
            [amount.add(1)]
          )).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });

    it("should not revert if allowance is greater than the sum of amounts", async () => {
      const amount = ethers.utils.parseEther('1000');
      await jimizz.approve(batchTransfer.address, amount);

      await expect(
        batchTransfer
          .batchTransfer(
            [owner.address],
            [amount.sub(1)]
          )).to.be.not.reverted;
    });

    it("should revert if number of recipients exceeds 100", async () => {
      const amount = ethers.utils.parseEther('1');
      const recipients = Array.from(
        {length: 101},
        () => accounts[0].address
      );
      const amounts = Array.from(
        {length: 101},
        () => amount
      );
      await jimizz.approve(batchTransfer.address, amount.mul(101));
      await expect(
        batchTransfer.batchTransfer(recipients, amounts)
      ).to.be.revertedWith("Maximum 100 recipients");
    });

    it("should revert if number of recipients differs from number of amounts", async () => {
      const amount = ethers.utils.parseEther('1');
      const recipients = Array.from(
        {length: 10},
        () => accounts[0].address
      );
      const amounts = Array.from(
        {length: 11},
        () => amount
      );
      await jimizz.approve(batchTransfer.address, amount.mul(11));
      await expect(
        batchTransfer.batchTransfer(recipients, amounts)
      ).to.be.revertedWith("Invalid input parameters");
    });

    it("should execute transfers", async () => {
      const recipients = [];
      const amounts = [];
      let total = 0;

      for (let i = 0; i < accounts.length; i++) {
        recipients.push(accounts[i].address);

        const amount = (i + 1) * 1000;
        total += amount;
        amounts.push(ethers.utils.parseEther(amount.toString()));
      }

      await jimizz.approve(
        batchTransfer.address,
        ethers.utils.parseEther(total.toString())
      );
      await batchTransfer.batchTransfer(recipients, amounts);

      for (let i = 0; i < accounts.length; i++) {
        const amount = (i + 1) * 1000;
        expect(await jimizz.balanceOf(accounts[i].address))
          .to.eq(ethers.utils.parseEther(amount.toString()));
      }
    });

    it("should allow owner to drain", async () => {
      // Give funds to an other accounts
      const amount = ethers.utils.parseEther('1000');
      await jimizz.transfer(accounts[0].address, amount);

      // Send to batchTransfer
      await jimizz
        .connect(accounts[0])
        .transfer(batchTransfer.address, amount);

      // Drain
      const prevBalance = await jimizz.balanceOf(owner.address);
      await batchTransfer.drain();
      const newBalance = await jimizz.balanceOf(owner.address);
      expect(newBalance).to.eq(prevBalance.add(amount));
    });
  })
});
