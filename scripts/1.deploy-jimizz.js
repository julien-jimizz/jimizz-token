const hre = require("hardhat");
const {logDeploy} = require("./deploy-utils");

async function main() {
  // Deploy Jimizz
  const Jimizz = await hre.ethers.getContractFactory("Jimizz");
  const jimizz = await Jimizz.deploy();
  await jimizz.deployed();
  logDeploy(['Jimizz', jimizz.address]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
