/*
SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const faucet = require('./lib/faucet.js');

module.exports.Faucet = faucet;
module.exports.contracts = [faucet];