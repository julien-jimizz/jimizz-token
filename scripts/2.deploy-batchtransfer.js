const hre = require("hardhat");
const {logDeploy, getAddress} = require("./deploy-utils");

async function main() {
	let token = await getAddress('Jimizz');

	// Deploy BatchTransfer
	const BatchTransfer = await hre.ethers.getContractFactory("BatchTransfer");
	const batchTransfer = await BatchTransfer.deploy(token);
	await batchTransfer.deployed();
	logDeploy(['BatchTransfer', batchTransfer.address]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
