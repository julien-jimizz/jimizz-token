const { expect } = require("chai");
const { ethers } = require("hardhat");
const {BigNumber} = require("ethers");

describe("StakingCampaign contract", () => {
  const rewardsPercentage = 2000;
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

  const supplyRewardsForAmount = async (amount) => {
    await jimizz.transfer(
      stakingCampaign.address,
      amount.mul(rewardsPercentage).div(10000)
    );
  }

  beforeEach(async () => {
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

  describe("Staking", () => {
    it("should not allow staking if campaign does not have enough funds", async () => {
      // Try to stake with not enough balance
      const balance = await jimizz.balanceOf(stakingCampaign.address);
      const amount = balance.add(ethers.utils.parseEther('1'));
      await jimizz.approve(stakingCampaign.address, amount);
      await expect(
        stakingCampaign.stake(amount)
      ).to.be.revertedWith("Campaign does not have enough tokens to allow this amount");

      // Give 800 JMZ to the campaign
      const stock = ethers.utils.parseEther('800');
      await jimizz.transfer(stakingCampaign.address, stock);

      // Transfer funds to account
      // We give 5000 JMZ, which corresponds to a reward of 1250
      const jmz = jimizz.connect(accounts[0]);
      const campaign = stakingCampaign.connect(accounts[0]);
      const amount2 = ethers.utils.parseEther('1000');
      const amount3 = ethers.utils.parseEther('2000');
      const amount4 = ethers.utils.parseEther('2000');
      await transferTo(
        0,
        amount2
          .add(amount3)
          .add(amount4)
      );

      // Stake amount2 (1000 for 200) - should be ok
      await jmz.approve(stakingCampaign.address, amount2);
      await campaign.stake(amount2);

      // Stake amount3 (2000 for 400) - should be ok
      await jmz.approve(stakingCampaign.address, amount3);
      await campaign.stake(amount3);

      // Stake amount4 (2000 for 400) - should fail
      await jmz.approve(stakingCampaign.address, amount4);
      await expect(
        campaign.stake(amount4)
      ).to.be.revertedWith("Campaign does not have enough tokens to allow this amount");

      // Stake 1000 for 200 - should be ok
      const amount5 = ethers.utils.parseEther('1000');
      await jmz.approve(stakingCampaign.address, amount5);
      campaign.stake(amount5);
    });

    it("should not allow staking if amount is 0", async () => {
      await expect(
        stakingCampaign.stake(0)
      ).to.be.revertedWith("You need to stake more than 0");
    });

    it("transfer must fail if allowance is too low", async () => {
      const amount = ethers.utils.parseEther('1000');
      await supplyRewardsForAmount(amount);

      await expect(
        stakingCampaign.stake(amount)
      ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");

      await jimizz.approve(stakingCampaign.address, 1);
      await expect(
        stakingCampaign.stake(amount)
      ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });

    it("transfer must succeed to allow staking", async () => {
      const amount = ethers.utils.parseEther('1000');
      await supplyRewardsForAmount(amount);

      await jimizz.approve(stakingCampaign.address, amount);
      await stakingCampaign.stake(amount);
    });

    it("hasStake must return false if staker does not have any stake", async () => {
      let [hasStake] = await stakingCampaign.hasStake(accounts[1].address);
      expect(hasStake).to.eq(false);
      [hasStake] = await stakingCampaign.hasStake(accounts[2].address);
      expect(hasStake).to.eq(false);
    });

    it("hasStake must return true if staker has stakes", async () => {
      // Give some Jimizz to stake to accounts[3]
      const amount = ethers.utils.parseEther('12000');
      await transferTo(3, amount);
      await supplyRewardsForAmount(amount);

      // Stake
      await jimizz.connect(accounts[3]).approve(stakingCampaign.address, amount);
      await stakingCampaign.connect(accounts[3]).stake(amount);

      [hasStake, total] = await stakingCampaign.hasStake(accounts[3].address);
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
      const amount2 = ethers.utils.parseEther('2000');
      const campaign = stakingCampaign.connect(accounts[4]);

      // Give some Jimizz to stake to accounts[4]
      await transferTo(4, amount1.add(amount2));
      await supplyRewardsForAmount(amount1.add(amount2));

      // Stake
      await jimizz.connect(accounts[4]).approve(stakingCampaign.address, amount1);
      await campaign.stake(amount1);

      // Get stakes summary
      summary = await campaign.getStakes();
      expect(summary.length).to.eq(1);
      expect(summary[0].amount).to.eq(amount1);

      // Add one more stake
      await jimizz.connect(accounts[4]).approve(stakingCampaign.address, amount2);
      await campaign.stake(amount2);

      // Get stakes summary again
      summary = await campaign.getStakes();
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
      const jmz = jimizz.connect(accounts[0]);
      const campaign = stakingCampaign.connect(accounts[0]);
      const amount = ethers.utils.parseEther('1000');
      await transferTo(0, amount);
      await supplyRewardsForAmount(amount);

      // Stake
      await jmz.approve(stakingCampaign.address, amount);
      await campaign.stake(amount);

      // Trying to withdraw - should fail
      await expect(
        campaign.withdraw()
      ).to.be.revertedWith("Nothing to withdraw yet");

      // Increasing time to one second before the end of lockup
      // Trying to withdraw - should fail
      await increaseTime(lockupTime - 1000);
      await expect(
        campaign.withdraw()
      ).to.be.revertedWith("Nothing to withdraw yet");

      // Increasing time to lockup time
      // Trying to withdraw - should be ok
      await increaseTime(1000);
      await campaign.withdraw();
    });

    it("should calculate rewards through time", async () => {
      let summary;
      const jm = jimizz.connect(accounts[5]);
      const sc = stakingCampaign.connect(accounts[5]);
      const amount = ethers.utils.parseEther('1000');
      const expectedRewards = amount.mul(rewardsPercentage).div(10000);

      // Give some funds
      await transferTo(5, amount);
      await supplyRewardsForAmount(amount);

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
      const stC = stakingCampaign.connect(accounts[6]);

      // Give some Jimizz to stake
      const amount1 = ethers.utils.parseEther('10000');
      const amount2 = ethers.utils.parseEther('5000');
      const amount3 = ethers.utils.parseEther('1000');
      await transferTo(6, amount1.add(amount2).add(amount3));


      const balance = async () => {
        return (await jimizz.balanceOf(accounts[6].address));
      };

      const reward = (amount) => {
        return amount.add(
          amount.mul(rewardsPercentage).div(10000)
        );
      }

      const stakeAndWait = async (amount) => {
        await supplyRewardsForAmount(amount);

        // Stake
        await jimizz.connect(accounts[6]).approve(stakingCampaign.address, amount);
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
      const rewards = amount.mul(rewardsPercentage).div(10000);
      await supplyRewardsForAmount(amount);

      // Check available rewards
      expect(await stakingCampaign.getAvailableRewards()).to.eq(rewards);

      // Balance of owner should change after staking for a tier
      const prevBalance = await jimizz.balanceOf(owner.address);
      await jimizz.approve(stakingCampaign.address, amount);
      await stakingCampaign.stakeFor(accounts[7].address, amount);
      const newBalance = await jimizz.balanceOf(owner.address);
      expect(newBalance).to.eq(prevBalance.sub(amount));

      // Check stakes
      const summary = await stakingCampaign.connect(accounts[7]).getStakes();
      expect(summary.length).to.eq(1);
      expect(summary[0].amount).to.eq(amount);

      // Check available rewards - should be 0 now
      expect(await stakingCampaign.getAvailableRewards()).to.eq(0);

      // Withdraw should revert
      await expect(
        stakingCampaign.connect(accounts[7]).withdraw()
      ).to.be.revertedWith("Nothing to withdraw yet");

      // Increase time
      await increaseTime(lockupTime);

      // Withdraw should not revert and balance should be updated
      const accountPrevBalance = await jimizz.balanceOf(accounts[7].address);
      expect(accountPrevBalance).to.eq(0);
      await stakingCampaign.connect(accounts[7]).withdraw();
      const accountNewBalance = await jimizz.balanceOf(accounts[7].address);
      const expected = amount.add(amount.mul(rewardsPercentage).div(10000));
      expect(accountNewBalance).to.eq(expected);
    });

    it("should recalculate available rewards at each stake", async () => {
      const stake = async (index, _amount) => {
        // Get current available amount of rewards
        const availableRewards = await stakingCampaign.getAvailableRewards();

        // Give funds to account
        const amount = ethers.utils.parseEther(_amount.toString());
        await transferTo(index, amount);

        // Stake
        await jimizz
          .connect(accounts[index])
          .approve(stakingCampaign.address, amount);
        await stakingCampaign
          .connect(accounts[index])
          .stake(amount);

        // Expect that rewards will be decremented on availableRewards
        await expectAvailableAmount(
          availableRewards.sub(
            amount
              .mul(rewardsPercentage)
              .div(10000)
          ));
      };

      const withdraw = async (index) => {
        await stakingCampaign
          .connect(accounts[index])
          .withdraw();
      };

      const expectAvailableAmount = async (amount) => {
        if (!(amount instanceof BigNumber)) {
          amount = ethers.utils.parseEther(amount.toString());
        }

        const availableRewards = await stakingCampaign.getAvailableRewards();
        expect(availableRewards).to.eq(amount);
      }

      // Provision campaign with 10 000 JMZ
      const totalRewards = ethers.utils.parseEther('10000');
      await jimizz.transfer(stakingCampaign.address, totalRewards);
      await expectAvailableAmount(10000);

      // Stake some on the first day
      await stake(0, 500); // Rewards: 100 - Remaining: 9900
      await stake(1, 1000); // Rewards: 200 - Remaining: 9700
      await stake(2, 2000); // Rewards: 400 - Remaining: 9300

      // Increase time to the end of lockup
      await increaseTime(lockupTime);

      // Withdraw from one account
      await withdraw(0);

      // Stake more
      await stake(0, 500); // Rewards: 100 - Remaining: 9200
      await stake(3, 3000); // Rewards: 600 - Remaining: 8600
      await stake(4, 4000); // Rewards: 800 - Remaining: 7800
      await stake(5, 5000); // Rewards: 1000 - Remaining: 6800

      // Increase time to the end of lockup
      await increaseTime(lockupTime);

      // Withdraw from a few accounts
      await withdraw(0);
      await withdraw(1);
      await withdraw(5);

      // Stack more
      await stake(0, 500); // Rewards: 100 - Remaining: 6700
      await stake(5, 5000); // Rewards: 1000 - Remaining: 5700
      await stake(6, 6000); // Rewards: 1200 - Remaining: 4500
      await stake(7, 7000); // Rewards: 1400 - Remaining: 3100
      await stake(8, 8000); // Rewards: 1600 - Remaining: 1500

      // Stake too much - must fail
      await expect(
        stake(9, 9000) // Rewards: 1800
      ).to.be.revertedWith("Campaign does not have enough tokens to allow this amount");

      // Stake right amount to empty available rewards
      await stake(9, 7500) // Rewards: 1500 - Remaining: 1500
      await expectAvailableAmount(0);

      await expect(
        stake(0, 1)
      ).to.be.revertedWith("Campaign does not have enough tokens to allow this amount");
    });

    it("should recalculate available rewards when balance changes", async () => {
      // Provision campaign with 100 JMZ
      const totalRewards = ethers.utils.parseEther('100');
      await jimizz.transfer(stakingCampaign.address, totalRewards);

      // Stake and empty the available rewards amount
      const amount = ethers.utils.parseEther('500');
      await jimizz.approve(stakingCampaign.address, amount);
      await stakingCampaign.stake(amount);
      expect(await stakingCampaign.getAvailableRewards()).to.eq(0);

      // Provision campaign again
      const totalRewards2 = ethers.utils.parseEther('5000');
      await jimizz.transfer(stakingCampaign.address, totalRewards2);
      expect(await stakingCampaign.getAvailableRewards()).to.eq(totalRewards2);
    });
  });
});
