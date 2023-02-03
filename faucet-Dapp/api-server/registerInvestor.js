/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // load the network configuration
        const ccpPath = path.resolve(__dirname, '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA.
        const caURL = ccp.certificateAuthorities['ca.org1.example.com'].url;
        const ca = new FabricCAServices(caURL);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'adminWallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get('Rama');
        if (userIdentity) {
            console.log('An identity for the user "Rama" already exists in the wallet');
            return;
        }

        // Check to see if we've already enrolled the admin user.
        const adminIdentity = await wallet.get('admin');
        if (!adminIdentity) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            console.log('Run the enrollAdmin.js application before retrying');
            return;
        }

        // build a user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'admin');

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({
            affiliation: 'org1.department1',
            enrollmentID: 'Rama',
            role: 'client',
            attrs: [{ name: 'role', value: 'Investor', ecert: true },{ name: 'userId', value: 'Rama', ecert: true }],
        }, adminUser);
        const enrollment = await ca.enroll({
            enrollmentID: 'Rama',
            enrollmentSecret: secret,
            attr_reqs: [{ name: "role", optional: false },{ name: "userId", optional: false }]
        });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put('Rama', x509Identity);
        console.log('Successfully registered and enrolled admin user "Rama" and imported it into the wallet');

        // -----------------------Create Wallet with default balance on ledger------------------ 
                // Create a new gateway for connecting to our peer node.
                const gateway = new Gateway();
                await gateway.connect(ccp, { wallet, identity: 'Rama', discovery: { enabled: true, asLocalhost: true } });
        
                // Get the network (channel) our contract is deployed to.
                const network = await gateway.getNetwork('mychannel');
        
                // Get the contract from the network.
                const contract = network.getContract('dltContract');
        
                const res = await contract.submitTransaction('createCar',"Asset018", 'hairKrishna', 'ramSita', 'Hair', 'Krishna');
                console.log("Token name ::", res.toString());
        
                const result2 = await contract.evaluateTransaction('queryAllCars');
                console.log('Mint status :: ', result2.toString());
        
            
               
                // Disconnect from the gateway.
                await gateway.disconnect();

    } catch (error) {
        console.error(`Failed to register user "Rama": ${error}`);
        process.exit(1);
      }
}

main();
