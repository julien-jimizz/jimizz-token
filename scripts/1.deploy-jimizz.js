const hre = require("hardhat");

async function main() {
  // Deploy Jimizz
  const Jimizz = await hre.ethers.getContractFactory("Jimizz");
  const jimizz = await Jimizz.deploy();
  await jimizz.deployed();
  console.log("Jimizz deployed to:", jimizz.address);

  // Deploy BatchTransfer
  const BatchTransfer = await hre.ethers.getContractFactory("BatchTransfer");
  const batchTransfer = await BatchTransfer.deploy(jimizz.address);
  await batchTransfer.deployed();
  console.log("BatchTransfer deployed to:", batchTransfer.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
