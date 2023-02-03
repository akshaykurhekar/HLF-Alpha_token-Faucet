/*
SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const { Contract } = require('fabric-contract-api');
const ClientIdentity = require('fabric-shim').ClientIdentity;


const balancePrefix = 'balance';

// table X
// key - value
// ERC20 token name : Aplha
// Define key names for options
const nameKey = 'name';
const symbolKey = 'symbol';
const decimalsKey = 'decimals';
const totalSupplyKey = 'totalSupply';
// let cid;

class Faucet extends Contract {

    async initLedger(ctx){
        return {status:true, message:'Chaincode init Success...!'}
    }
    
    async setToken(ctx){
        // validating user role
        let cid = new ClientIdentity(ctx.stub)
        const role = await cid.getAttributeValue('role'); // get role from cert of registered user.
        
        if(role !== 'admin') {
            return {status:false, message:'User is not Authorized to set Tokens....!'}  
        }
        await ctx.stub.putState(nameKey, Buffer.from('Alpha')) // to create a state on ledger
        await ctx.stub.putState(symbolKey, Buffer.from('ALP')) // to create a state on ledger
        await ctx.stub.putState(decimalsKey, Buffer.from('18')) // to create a state on ledger
        await ctx.stub.putState(totalSupplyKey, Buffer.from('0')) // to create a state on ledger
        return {status:true, message:'success'};
    }

    async getTokenName(ctx) {
        const nameBytes = await ctx.stub.getState(nameKey);
        return {status:true, message:'success', data:nameBytes.toString()};        
    }

    async getTokenSymbol(ctx) {
        const symbolBytes = await ctx.stub.getState(symbolKey);
        return {status:true, message:'success', data:symbolBytes.toString()};        
    }

    async getTokenDecimals(ctx) {
        const decimalBytes = await ctx.stub.getState(decimalsKey);
        return {status:true, message:'success', data:decimalBytes.toString()};
      
    }

    // get totalSupply     
    async getTotalSupply(ctx) {
        const totalSupplyBytes = await ctx.stub.getState(totalSupplyKey);
        return {status:true, message:'success', data:totalSupplyBytes.toString()};
    }

    // createWallet for users initial balance is zero
    async createWallet(ctx, timeStamp, amount) {
        let cid = new ClientIdentity(ctx.stub);
        const userId = await cid.getAttributeValue('userId'); // get userId from cert of registered user.
        let walletKey = `wallet_${userId}`;
        
        const wallet = {
            tokenName:'Alpha',
            timeStamp:timeStamp,
            balance:amount
        }    
        await ctx.stub.putState(walletKey, Buffer.from(JSON.stringify(wallet)));
        return {status:true, message:'success'};
    }

    // we balance from user
    async getBalance(ctx) {
        let balance;
        let cid = new ClientIdentity(ctx.stub);
        const userId = await cid.getAttributeValue('userId'); // get userId from cert of registered user.
        let walletKey = `wallet_${userId}`;
        const walletBytes = await ctx.stub.getState(walletKey);
        const wallet = JSON.parse(walletBytes.toString());
        balance = parseInt(wallet.balance);
      
        return {status:true, data:balance, message:'success'};       
    }
    
    // only Minter can mint token
    async mintToken(ctx, args) {
        args = JSON.parse(args); // amount
        // validating user role
        let cid = new ClientIdentity(ctx.stub)
        const role = await cid.getAttributeValue('role'); // get role from cert of registered user.
        
        if(role !== 'Minter' || role !== 'admin') {
            return {status:false, message:'User is not Authorized to Mint Tokens....!'}  
        }
        // validating amount
        const amountInt = parseInt(args['amount']);
        if(amountInt < 0){
            return {status:false, message:'Amount should not be Zero....!'}  
        }        
        // call getBalance
        const minterBalance = await this.getBalance();                
        const updatedMinterBalance = minterBalance + amountInt;
        const timeStamp = new Date().getTime();
        await this.createWallet(timeStamp,updatedMinterBalance);

        // increment total supply
        let totalSupply;
        const totalSupplyBytes = await ctx.stub.getState(totalSupplyKey); // fetch the tokensupply value from ledger
        totalSupply = parseInt(totalSupplyBytes.toString());
        totalSupply = totalSupply + amountInt; // added tokenSupply with new amount
        await ctx.stub.putState(totalSupplyKey, Buffer.from(totalSupply.toString())); // key- value

        return {status:true, message:'success'};
    }

    // function to transfer token from one user to other.
    async Transfer(ctx){

        args = JSON.parse(args);    // receiver, amount 
        const receiver = args['receiver'];  
        let cid = new ClientIdentity(ctx.stub);
        const from = await cid.getAttributeValue('userId'); // get sender userId from cert of registered user.
        
         // Convert value from string to int
         const valueInt = parseInt(args['amount']);
         if (valueInt < 0) { // transfer of 0 is allowed in ERC20, so just validate against negative amounts
             return {status:false, message:'transfer amount cannot be negative'};
         } 
         // Retrieve the current balance of the sender
         const senderBalance = await this.getBalance();  
         if (!senderBalance || senderBalance === 0) {
             return { status:false, message:`this account ${from} has no balance`};
         }  
         // Check if the sender has enough tokens to spend.
         if (senderBalance < valueInt) {
            return { status:false, message:`client account ${from} has insufficient funds.`};             
         } 
         // Retrieve the current balance of the receiver
         let receiverWalletKey = `wallet_${receiver}`;
         const walletBytes = await ctx.stub.getState(receiverWalletKey);
         const receiverWallet = JSON.parse(walletBytes.toString());
         receiverBalance = parseInt(receiverWallet.balance); 

         // Update the balance
         const senderUpdatedBalance = senderBalance - valueInt;
         const receiverUpdatedBalance = receiverBalance + valueInt;
         const timeStamp = new Date().getTime();
         await this.createWallet(timeStamp,senderUpdatedBalance); // this will set sender wallet balance
         receiverWallet['balance'] = receiverUpdatedBalance;
         await ctx.stub.putState(receiverWalletKey, Buffer.from(JSON.stringify(receiverWallet)));
 
         return {status:true,message:`Transfer success from this user ${from} - ${receiver}`};
    }

   
    // faucetBalance()    
    async faucetBalance(ctx) {       
        
        let walletKey = `faucetWallet`;                        
        const wallet = await ctx.stub.getState(walletKey);
        return {status:true, message:'success', data:wallet.toString()};
    }

    // setFaucetWallet() // admin can only setFaucetBalance after minting token.
    async setFaucetWallet(ctx, args) {
        args = JSON.parse(args); // amount, timeDelay, timeStamp
        let cid = new ClientIdentity(ctx.stub);
        const role = await cid.getAttributeValue('role'); 
        amount = parseInt(args['amount']);
        
        if(role === 'admin'){
            const userBalance = await this.getBalance();
            if(userBalance === 0){
                return {status:false, message:`your balance is 0..! Pls mint some tokens`}
            }    
            if(userBalance < amount){
                return {status:false, message:`you don't have enough token to send..! pls check balance.`}
            }            
            const wallet = {
                tokenName:'Alpha',
                modifiedAt:args['timeStamp'],
                balance:amount,
                timeDelay:args['timeDelay']     // 8640000-24min OR 180000-3min in millisecond
             }            
            let walletKey = `faucetWallet`;                        
            await ctx.stub.putState(walletKey, Buffer.from(JSON.stringify(wallet)));
            return {status:true, message:'success'};
        }else {
            return {status:false, message:`You don't have admin privilege...! Pls, check with admin.`}
        }
    }

    // requestToken() only 50 token once a day.
    async requestToken(ctx, args) {
        args = JSON.parse(args); // {userId:userId, timeStamp:timeStamp}
        const timeStamp = args['timeStamp'];
        // check faucet Wallet balance should be greater then 50 
        let faucetKey = `faucetWallet`;                        
        const faucetBytes = await ctx.stub.getState(faucetKey);
        const faucetWallet = JSON.parse(faucetBytes.string());
        let faucetBalance = parseInt(faucetWallet.balance);
        
        if(faucetBalance > 50){
            // send token to user            
            let walletKey = `wallet_${args['userId']}`;
            const walletBytes = await ctx.stub.getState(walletKey);
            const ledgerWallet = JSON.parse(walletBytes.toString());
            let balance = parseInt(ledgerWallet.balance);
            let walletTimeStamp = parseInt(ledgerWallet.timeStamp);

            // first check (timeStamp - walletTime ) should be greater then 8640000 is 24 hrs in millisecond
            // 180000 is 3 min in millisecond for testing.
            if((timeStamp - walletTimeStamp) > faucetWallet.timeDelay){              
                // add 50 token to prevBalance in user wallet
                let amount = balance + 50;
                // reduce 50 token from faucet wallet
                faucetWallet.balance = faucetBalance - 50;
                // update faucet wallet with new balance
                await ctx.stub.putState(faucetKey, Buffer.from(faucetWallet.toString()));               

                // update wallet to ledger with currentTimestamp and updatedBalance
                const wallet = {
                    tokenName:'Alpha',
                    timeStamp:timeStamp, // set new timestamp
                    balance:amount
                }                
                await ctx.stub.putState(walletKey, Buffer.from(wallet.toString()));
                return {status:true, message:' 50 Alpha token transferred successfully.'};
            }else {
                // return pls wait of 24 hrs to another 50 token
                return {status:false, message:'pls wait for 24 hrs to receive another 50 token...!'};
            }
        }else {
            // return faucet is empty OR not have enough funds
            return {status:false, message:'faucet is empty OR not have enough funds...!'};
        }    
    }   

    // queryAllAssets on ledger
    async queryAllAssets(ctx) {
                
    const startKey = '';
    const endKey = '';
    const allResults = [];
    for await (const {key, value} of ctx.stub.getStateByRange(startKey, endKey)) {
        const strValue = Buffer.from(value).toString('utf8');
        let record;
        try {
            record = JSON.parse(strValue);
        } catch (err) {
            console.log(err);
            record = strValue;
        }
        allResults.push({ Key: key, Record: record });
    }

    console.info(allResults);
    if (!allResults || allResults.length === 0)
        {
            return {status:false, error: `No assets exist on ledger`};
        } else {
            return {status:true, data:JSON.stringify(allResults)};
        }
    }

    //get history of project
    async queryHistoryOfAsset(ctx, args) {
        args = JSON.parse(args);
        const assetId = assetId;
    for await (const {key, value} of ctx.stub.getHistoryForKey(assetId)) {
        const strValue = Buffer.from(value).toString('utf8');
        let record;
        try {
            record = JSON.parse(strValue);
        } catch (err) {
            console.log(err);
            record = strValue;
        }
        allResults.push({ Key: key, Record: record });
    }
    console.info(allResults);
    
    if (!allResults || allResults.length === 0)
        {
            return {status:false, error: `${assetId} does not exist`};
        } else {
            return {status:true, data:JSON.stringify(allResults)};
        }
}

}

module.exports = Faucet;
