const hre = require("hardhat");
const {logDeploy, getAddress, getInstance} = require("./deploy-utils");

async function main() {
  let token = await getAddress('Jimizz');

  // Add Gateway service
  const distributor = await getInstance('FeesDistributor');
  await distributor.addService("Gateway");

  // Deploy Gateway
  const Gateway = await hre.ethers.getContractFactory("Gateway");
  const gateway = await Gateway.deploy(token, distributor.address);
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
