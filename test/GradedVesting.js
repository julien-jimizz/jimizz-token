const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GradedVesting contract", () => {
  const amount = ethers.utils.parseEther('10000');
  const percentages = [5, 10, 15, 20, 25, 30, 65, 100];
  const schedules = ((nb) => {
    const schedules = [];
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    date.setUTCHours(10);
    date.setUTCMinutes(0);
    date.setUTCSeconds(0);

    for (let i = 0; i < nb; i++) {
      date.setUTCMonth(date.getUTCMonth() + 1);
      schedules.push(Math.floor(+date / 1000));
    }

    return schedules;
  })(percentages.length);

  let jimizz;
  let owner;
  let accounts;

  const deploy = async (owner) => {
    const GradedVesting = await ethers.getContractFactory("GradedVesting");
    return await GradedVesting.deploy(
      jimizz.address,
      owner,
      amount,
      schedules,
      percentages
    );
  }

  const setTime = async (time) => {
    await ethers.provider.send("evm_setNextBlockTimestamp", [time]);
    await ethers.provider.send("evm_mine");
  }

  beforeEach(async () => {
    const Jimizz = await ethers.getContractFactory("Jimizz");
    jimizz = await Jimizz.deploy();

    [owner, ...accounts] = await ethers.getSigners();
  });

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      const gradedVesting = await deploy(accounts[0].address);
      expect(await gradedVesting.owner()).to.equal(owner.address);
    });

    it("Should set the schedules", async () => {
      const gradedVesting = await deploy(accounts[0].address);

      const result = await gradedVesting.getSchedules();

      const _schedules = result.map(r => r.timestamp.toNumber());
      expect(_schedules).to.have.members(schedules);

      const _percentages = result.map(r => r.percentage);
      expect(_percentages).to.have.members(percentages);
    });
  });

  describe("Collecting", () => {
    it("should return error if contract does not have tokens", async () => {
      const gradedVesting = await deploy(accounts[0].address);
      await expect(
        gradedVesting.connect(accounts[0]).collect()
      ).to.be.revertedWith("This contract does not have any token");
    });

    it("should return error if available amount is zero", async () => {
      const gradedVesting = await deploy(accounts[0].address);

      // Give tokens to contract
      await jimizz.transfer(gradedVesting.address, amount);

      // Collect
      await expect(
        gradedVesting.connect(accounts[0]).collect()
      ).to.be.revertedWith("Nothing to collect");
    });

    it("should be able to collect on each date", async () => {
      const gradedVesting = await deploy(accounts[0].address);

      // Give tokens to contract
      await jimizz.transfer(gradedVesting.address, amount);

      // Collect over time
      for (let i = 0; i < schedules.length; i++) {
        await setTime(schedules[i] + 60);
        await gradedVesting.connect(accounts[0]).collect();
      }
    });

    it("should be able to collect multiple past dates", async () => {
      const gradedVesting = await deploy(accounts[0].address);

      // Give tokens to contract
      await jimizz.transfer(gradedVesting.address, amount);

      // Back to the future and collect
      await setTime(+schedules.slice(-1) + 120);
      await gradedVesting.connect(accounts[0]).collect();
    });
  });
});
