"use strict";

var bigInt = require('big-integer');
var cryptoJs = require('crypto-js');
var _ = require('underscore');

var latinString = "The quick brown fox jumped over the lazy dog.";
var longerLatinString = "BigInteger.js is an arbitrary - length integer library for Javascript, allowing arithmetic operations on integers of unlimited size, notwithstanding memory and time limitations.";
var mixedString = "The quick brown Фокс jumped over the lazy собака";

// Shortcut to convert a char to an ascii code
var charFor = function (char) {
    return char.charCodeAt(0);
};

// == Setup

// Setup ranges
var rangesConfig = [
    { name: 'latinLower', range: [charFor('a'), charFor('z')] },
    { name: 'latinUpper', range: [charFor('A'), charFor('Z')] },
    { name: 'cyrillicLower', range: [charFor('а'), charFor('я')] },
    { name: 'cyrillicUpper', range: [charFor('А'), charFor('Я')] },
];

_.each(rangesConfig, function (conf) {
    conf.base = conf.range[1] - conf.range[0] + 1;
})

// == Internal functions


// Converts a char to a tuple
var charToTuple = function(char) {
    var charCode = charFor(char);
    var match = _.find(rangesConfig, function (conf) {
        return charCode >= conf.range[0] && charCode <= conf.range[1];
    });

    return match ? [charCode - match.range[0], match.base] : null;
}

var stringToTuples = function(str) {
    var tuples = [];
    for (var i = 0; i < str.length; i++) {
        var char = str[i];
        tuples.push([char, charToTuple(char)]);
    }

    return tuples;
}

function Block()
{
    this.tuples = [];
    this.encoded = bigInt.zero;
    this.remainder = bigInt.zero;
    this.encrypted = null;

    this.toWordArray = function ()
    {

    }
}

var WORD_MAX = Math.pow(2, 32);
// Leaving room for AES padding
var BLOCK_MAX_BITS = 120;

function bigIntToWordArray(bigIntValue)
{
    console.log("BigInt: %s", bigIntValue.toString());
    
    var wordArr = [];
    while (bigIntValue > 0) {
        var result = bigIntValue.divmod(WORD_MAX);
        var remainder = result.remainder;
        if (remainder > Math.pow(2, 31)) {
            // Two's complement.  Bitwise stuff goes weird at this range.
            remainder = remainder.subtract(WORD_MAX).add(1);
        }
        wordArr.push(remainder.valueOf());
        bigIntValue = result.quotient;
    }
    
    // TODO: Getting the _actual_ number of sig bytes here based on the encoded data would be better
    return cryptoJs.lib.WordArray.create(wordArr.reverse(), BLOCK_MAX_BITS / 8);
}

function wordArrayToBigInt(wordArr, seed)
{
    var val = seed || bigInt.zero;
    _.each(wordArr.words, function(w) {
        val = val.multiply(WORD_MAX).add(w);
    });

    return val;
}

function blockify(tuples) {
    var blockAcc = bigInt.one;
    var blockMax = bigInt(2).pow(BLOCK_MAX_BITS);
    //console.log(blockMax);
    
    var blocks = [new Block()];
    var currentBlock;

    _.each(tuples, function (t) {
        var lastBlock = _.last(blocks);
        if (t[1]) {
            var value = t[1][0];
            var base = t[1][1];
            var newBlockAcc = blockAcc.multiply(base);
            if (newBlockAcc > blockMax) {
                // Reset the block  and the encoding
                newBlockAcc = bigInt(base);
                blocks.push(new Block());
                lastBlock = _.last(blocks);
            }
            blockAcc = newBlockAcc;
            
            var encoded = lastBlock.encoded;
            lastBlock.encoded = encoded.multiply(base).add(value);

        }
        lastBlock.tuples.push(t);
    });

    return blocks;
}

var blocks= blockify(stringToTuples(mixedString));
//console.log(blocks[0].encoded.toString());
//console.log(blocks[0]);

var wordArray = bigIntToWordArray(blocks[0].encoded);
console.log(wordArray);

var key = cryptoJs.enc.Hex.parse('000102030405060708090a0b0c0d0e0f');
var iv = cryptoJs.enc.Hex.parse('101112131415161718191a1b1c1d1e1f');

var encrypted = cryptoJs.AES.encrypt(wordArray, key, { iv: iv });
console.log(encrypted.ciphertext);

var decrypted = cryptoJs.AES.decrypt(encrypted, key, { iv: iv });
console.log(decrypted);



//console.log(blockify(stringToTuples(mixedString)));

//console.log(rangesConfig);
//console.log(stringToTuples(mixedString));

// == Exports
exports.__privateFunctions = {
    charFor: charFor,
    charToTuple: charToTuple,
    stringToTuples: stringToTuples
};

