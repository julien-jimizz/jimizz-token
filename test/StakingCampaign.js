const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StakingCampaign contract", () => {
  const rewardsPercentage = 20;
  const lockupTime = 100 * 24 * 60 * 60; // 100 days
  let jimizz;
  let stakingCampaign;
  let owner;
  let accounts;

  const transferTo = async (index, amount) => {
    await jimizz.transfer(accounts[index].address, amount);
  }

  const increaseTime = async (period) => {
    await ethers.provider.send("evm_increaseTime", [period]);
    await ethers.provider.send("evm_mine");
  }

  const closeAndReopen = async (callback) => {
    let _open;

    // Close
    await stakingCampaign.setOpen(false);
    _open = await stakingCampaign.open();
    expect(_open).to.equal(false);

    if (callback) {
      await callback.call();
    }

    // Re open
    await stakingCampaign.setOpen(true);
    _open = await stakingCampaign.open();
    expect(_open).to.equal(true);
  }

  before(async () => {
    const Jimizz = await ethers.getContractFactory("Jimizz");
    const StakingCampaign = await ethers.getContractFactory("StakingCampaign");
    [owner, ...accounts] = await ethers.getSigners();

    jimizz = await Jimizz.deploy();
    stakingCampaign = await StakingCampaign.deploy(
      jimizz.address,
      rewardsPercentage,
      lockupTime
    );
  });

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      expect(await stakingCampaign.owner()).to.equal(owner.address);
    });

    it("Should set the right percentage", async () => {
      const _rewardsPercentage = await stakingCampaign.rewardsPercentage();
      expect(_rewardsPercentage).to.equal(rewardsPercentage);
    });

    it("Should set the right lockup time", async () => {
      const _lockupTime = await stakingCampaign.lockupTime();
      expect(_lockupTime).to.equal(lockupTime);
    });
  });

  describe("Open/Close management", () => {
    it("Should be open when deployed", async () => {
      const _open = await stakingCampaign.open();
      expect(_open).to.equal(true);
    });

    it("open value should change when using setter", async () => {
      await closeAndReopen();
    });
  });

  describe("Staking", () => {
    it("should not allow staking if campaign is closed", async () => {
      await closeAndReopen(async () => {
        await expect(
          stakingCampaign.stake(1)
        ).to.be.revertedWith("Campaign is currently closed");
      });
    });

    it("should not allow staking if amount is 0", async () => {
      await expect(
        stakingCampaign.stake(0)
      ).to.be.revertedWith("You need to stake more than 0");
    });

    it("transfer must fail if allowance is too low", async () => {
      const amount = ethers.utils.parseEther('1000');
      await expect(
        stakingCampaign.stake(amount)
      ).to.be.reverted;

      await jimizz.approve(stakingCampaign.address, 1);
      await expect(
        stakingCampaign.stake(amount)
      ).to.be.reverted;
    });

    it("transfer must succeed to allow staking", async () => {
      const amount = ethers.utils.parseEther('1000');
      await jimizz.approve(stakingCampaign.address, amount);
      await stakingCampaign.stake(amount);
    });

    it("hasStake must return false if staker does not have any stake", async () => {
      let [hasStake] = await stakingCampaign.hasStake(accounts[0].address);
      expect(hasStake).to.eq(false);
      [hasStake] = await stakingCampaign.hasStake(accounts[1].address);
      expect(hasStake).to.eq(false);
    });

    it("hasStake must return true if staker has stakes", async () => {
      let [hasStake, total] = await stakingCampaign.hasStake(owner.address);
      expect(hasStake).to.eq(true);
      expect(total).to.eq(ethers.utils.parseEther('1000'));

      // Give some Jimizz to stake to accounts[0]
      const amount = ethers.utils.parseEther('12000');
      await transferTo(0, amount);

      // Stake
      await jimizz.connect(accounts[0]).approve(stakingCampaign.address, amount);
      await stakingCampaign.connect(accounts[0]).stake(amount);

      [hasStake, total] = await stakingCampaign.hasStake(accounts[0].address);
      expect(hasStake).to.eq(true);
      expect(total).to.eq(amount);
    });

    it("getStakes must revert if staker has no stakes", async () => {
      await expect(
        stakingCampaign.connect(accounts[9]).getStakes()
      ).to.be.revertedWith("You don't have any stakes");
    });

    it("getStakes must return list of stakes", async () => {
      let summary;
      const amount1 = ethers.utils.parseEther('1000');
      const amount2 = ethers.utils.parseEther('2000')

      summary = await stakingCampaign.getStakes();
      expect(summary.length).to.eq(1);
      expect(summary[0].amount).to.eq(amount1);

      // Add one more stake
      await jimizz.approve(stakingCampaign.address, amount2);
      await stakingCampaign.stake(amount2);

      summary = await stakingCampaign.getStakes();
      expect(summary.length).to.eq(2);
      expect(summary[0].amount).to.eq(amount1);
      expect(summary[1].amount).to.eq(amount2);
    });

    it("should prevent user from withdrawing if they have no stakes", async () => {
      await expect(
        stakingCampaign.connect(accounts[9]).withdraw()
      ).to.be.revertedWith("You don't have any stake yet");
    });

    it("should prevent user from withdrawing anything during lockup period", async () => {
      await expect(
        stakingCampaign.withdraw()
      ).to.be.revertedWith("Nothing to withdraw yet");
    });

    it("should calculate rewards through time", async () => {
      let summary;
      const jm = jimizz.connect(accounts[1]);
      const sc = stakingCampaign.connect(accounts[1]);
      const amount = ethers.utils.parseEther('1000');
      const expectedRewards = amount.mul(rewardsPercentage).div(100);

      // Give some funds
      await transferTo(1, amount);

      // Stake
      await jm.approve(stakingCampaign.address, amount);
      await sc.stake(amount);

      summary = await sc.getStakes();
      expect(summary[0].rewards).to.eq(0);

      // Increase time until half of the lockup period
      await increaseTime(lockupTime / 2);

      summary = await sc.getStakes();
      expect(summary[0].rewards).to.eq(ethers.BigNumber.from(expectedRewards).div(2));

      // Increase time to the end of lockup period
      await increaseTime(lockupTime / 2);

      summary = await sc.getStakes();
      expect(summary[0].rewards).to.eq(expectedRewards);
    });

    it("should allow withdraw and transfer funds after lockup period", async () => {
      const stC = stakingCampaign.connect(accounts[2]);

      // Give some Jimizz to stake
      const amount1 = ethers.utils.parseEther('10000');
      const amount2 = ethers.utils.parseEther('5000');
      const amount3 = ethers.utils.parseEther('1000');
      await transferTo(2, amount1.add(amount2).add(amount3));


      const balance = async () => {
        return (await jimizz.balanceOf(accounts[2].address));
      };

      const reward = (amount) => {
        return amount.add(
          amount.mul(rewardsPercentage).div(100)
        );
      }

      const stakeAndWait = async (amount) => {
        // Stake
        await jimizz.connect(accounts[2]).approve(stakingCampaign.address, amount);
        await stC.stake(amount);

        // Increase time to a quarter of the lockup period
        await increaseTime(lockupTime / 4);

        // Try to withdraw, error expected
        await expect(
          stC.withdraw()
        ).to.be.revertedWith("Nothing to withdraw yet");
      };

      // Stake three times and wait a quarter of the lockup period
      // between every stakes
      await stakeAndWait(amount1);
      await stakeAndWait(amount2);
      await stakeAndWait(amount3);

      // Increase time and try to withdraw
      // This time, we should be able to withdraw first amount
      await increaseTime(lockupTime / 4);
      await stC.withdraw();
      expect(await balance()).to.eq(reward(amount1));

      // Increase time and try to withdraw second amount
      await increaseTime(lockupTime / 4);
      await stC.withdraw();
      expect(await balance()).to.eq(reward(amount1.add(amount2)));

      // Increase time and try to withdraw third amount
      await increaseTime(lockupTime / 4);
      await stC.withdraw();
      expect(await balance()).to.eq(reward(amount1.add(amount2).add(amount3)));

      // Nothing more to withdraw
      await expect(
        stC.withdraw()
      ).to.be.revertedWith("You don't have any stake yet");
    });

    it("should allow owner to place stakes for a given staker", async () => {
      const amount = ethers.utils.parseEther('10000');
      const prevBalance = await jimizz.balanceOf(owner.address);

      await jimizz.approve(stakingCampaign.address, amount);
      await stakingCampaign.stakeFor(accounts[3].address, amount);

      // Balance of owner should have changed
      const newBalance = await jimizz.balanceOf(owner.address);
      expect(newBalance).to.eq(prevBalance.sub(amount));

      // Check stakes
      const summary = await stakingCampaign.connect(accounts[3]).getStakes();
      expect(summary.length).to.eq(1);
      expect(summary[0].amount).to.eq(amount);

      await expect(
        stakingCampaign.connect(accounts[3]).withdraw()
      ).to.be.revertedWith("Nothing to withdraw yet");
    });
  });
});
