# Hyperledger Fabric Faucet Project.

1. Can we do cross chaincode.

 Yes,
 It is quite straightforward to query state through functions in other chaincodes. However, when state change happens, the cross chaincode invoking only works when both chaincodes are on the same channel. 

 2. InvokeChaincode method is used to call other chaincode in same channel.