const hre = require("hardhat");
const {logDeploy, getAddress} = require("./deploy-utils");

async function main() {
  let token = await getAddress('Jimizz');

  let feesBeneficiary = '0x2f9b4fca723f45533BA7F3a2be7dd08559DC271e';

  // Deploy Gateway
  const Gateway = await hre.ethers.getContractFactory("Gateway");
  const gateway = await Gateway.deploy(token, feesBeneficiary);
  await gateway.deployed();
  logDeploy(['Gateway', gateway.address]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
