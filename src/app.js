"use strict";

var bigInt = require('big-integer');
var cryptoJs = require('crypto-js');
var _ = require('underscore');

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
    { name: 'numeric', range: [charFor('0'), charFor('9')] },
];

_.each(rangesConfig, function (conf) {
    conf.base = conf.range[1] - conf.range[0] + 1;
})

// == Internal functions


// Converts a char to a tuple
var charToTuple = function(char) {
    var charCode = charFor(char);
    var matchIndex = _.findIndex(rangesConfig, function (conf, i) {
        return charCode >= conf.range[0] && charCode <= conf.range[1];
    });
    
    if (matchIndex != -1) {
        var match = rangesConfig[matchIndex];
        return [charCode - match.range[0], match.base, matchIndex];
    }

    return [char];
}

var tupleToChar = function (tuple) {
    if (tuple.length == 1) {
        return tuple[0];
    } else {
        var conf = rangesConfig[tuple[2]];
        return String.fromCharCode(tuple[0] + conf.range[0]);
    }
}

var stringToTuples = function(str) {
    var tuples = [];
    for (var i = 0; i < str.length; i++) {
        var char = str[i];
        tuples.push(charToTuple(char));
    }

    return tuples;
}

var tuplesToString = function (tuples) {
    // TODO: Benchmark string concatenation vs array.join
    var s = '';

    _.each(tuples, function (t) {
        s += tupleToChar(t);
    });

    return s;
}

var WORD_MAX = Math.pow(2, 32);
// We do our own damn padding
var BLOCK_MAX_BITS = 128;

var bigIntToWordArray = function(bigIntValue) {
    //console.log("BigInt: %s", bigIntValue.toString());
    
    var wordArr = [];
    for (var i = 0; i < Math.ceil(BLOCK_MAX_BITS / 32); i++) {
        var result = bigIntValue.divmod(WORD_MAX);
        var remainder = result.remainder;
        
        // These need to be signed integers, since wordArray needs those
        if (remainder >= Math.pow(2, 31)) {
            // Two's complement.  Bitwise stuff goes weird at this integer range.
            remainder = remainder.subtract(WORD_MAX);
        }
        wordArr.push(remainder.valueOf());
        bigIntValue = result.quotient;
    }
    
    // TODO: Getting the _actual_ number of sig bytes here based on the encoded data would be better
    return cryptoJs.lib.WordArray.create(wordArr.reverse());//, BLOCK_MAX_BITS / 8);
}

var wordArrayToBigInt = function(wordArr, seed) {
    var val = seed || bigInt.zero;
    _.each(wordArr.words, function (w) {
        val = val.multiply(WORD_MAX).add(w>>>0); // >>> coerces to unsigned, which is what we need here
    });
    
    return val;
}

// == Block object
function Block()
{
    this.tuples = [];
    this.encoded = bigInt.zero;
    this.remainder = bigInt.zero;
    this.encrypted = null;

    this.toWordArray = function ()
    {
        return bigIntToWordArray(this.encoded);
    }
}

var blockifyTuples = function(tuples) {
    var blockAcc = bigInt.one;
    var blockMax = bigInt(2).pow(BLOCK_MAX_BITS);
    //console.log(blockMax);
    
    var blocks = [new Block()];
    var currentBlock;
    
    _.each(tuples, function (t) {
        var lastBlock = _.last(blocks);
        if (t.length > 1) {
            var value = t[0];
            var base = t[1];
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

/*
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
*/


//console.log(blockify(stringToTuples(mixedString)));

//console.log(rangesConfig);
//console.log(stringToTuples(mixedString));

// == Exports
exports.__privateFunctions = {
    charFor: charFor,
    charToTuple: charToTuple,
    stringToTuples: stringToTuples,
    tupleToChar: tupleToChar,
    tuplesToString: tuplesToString,
    
    bigIntToWordArray: bigIntToWordArray,
    wordArrayToBigInt: wordArrayToBigInt,
    
    blockifyTuples: blockifyTuples,
    
    rangesConfig: rangesConfig
};

