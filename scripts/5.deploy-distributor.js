const hre = require("hardhat");
const {logDeploy, getAddress} = require("./deploy-utils");

async function main() {
  let token = await getAddress('Jimizz');

  const charityBeneficiary = '0xB0D2Aff330f50841D87c87AE60247Ba395E4ae39';

  // Deploy Distributor
  const Distributor = await hre.ethers.getContractFactory("FeesDistributor");
  const distributor = await Distributor.deploy(token, charityBeneficiary);
  await distributor.deployed();
  logDeploy(['FeesDistributor', distributor.address]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
