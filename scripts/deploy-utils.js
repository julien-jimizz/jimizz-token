const hre = require("hardhat");
const {existsSync, readFileSync, writeFileSync} = require('fs');
const {ethers} = require("hardhat");

function getAddress(name) {
	const address = JSON.parse(readFileSync(`deploy/${hre.network.name}.json`))[name];
	if (!address) {
		throw new Error(`Contract ${name} not found or not yet deployed`);
	}
	return address;
}

function getInstance(name) {
	return ethers.getContractFactory(name)
		.then(c => c.attach(getAddress(name)));
}

function logDeploy(contract) {
	const filename = `deploy/${hre.network.name}.json`;

	let json = {};
	if (existsSync(filename)) {
		json = JSON.parse(readFileSync(filename));
	}

	json[contract[0]] = contract[1];

	console.log(`${contract[0]} deployed to: ${contract[1]}`);
	writeFileSync(filename, JSON.stringify(json, null, 2));
}

module.exports = {
	getAddress,
	getInstance,
	logDeploy
}
