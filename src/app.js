﻿"use strict";

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
    // Latin, no unicode extensions yet
    { name: 'latinLower', range: [charFor('a'), charFor('z')] },
    { name: 'latinUpper', range: [charFor('A'), charFor('Z')] },
    // Cyrillic
    { name: 'cyrillicLower', range: [charFor('а'), charFor('я')] },
    { name: 'cyrillicUpper', range: [charFor('А'), charFor('Я')] },
    // Greek: these are incomplete based on the best contiguous case ranges I could find here: http://www.alanwood.net/unicode/greek.html
    { name: 'greekUpper', range: [charFor('Ά'), charFor('Ϋ')] },
    { name: 'greekLower', range: [charFor('ά'), charFor('ώ')] },
    // Hebrew from here: http://www.alanwood.net/unicode/hebrew.html
    { name: 'hebrew', range: [charFor('א'), charFor('ת')] },
    // Japanese
    { name: 'hiragana', range: [charFor('ぁ'), charFor('ゖ')] },
    { name: 'katakana', range: [charFor('゠'), charFor('ヺ')] },
    // Numbers, boring
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

// Bit manipulation stuff for Feistel network
var getBottomBits = function (wordArr, bits) {
    var bottomWordCount = Math.floor(bits / 32);

    var bitArr = bottomWordCount > 0 ? wordArr.slice(-bottomWordCount) : [];
    
    if (bottomWordCount > wordArr.length) {
        // Add padding
        _.times(bottomWordCount - wordArr.length, function () { bitArr.unshift(0) });
    }

    var remainingBits = bits % 32;

    if (remainingBits > 0) {
        var word = wordArr[wordArr.length - bottomWordCount - 1] || 0;
        var mask = getBitMask(remainingBits);
        bitArr.unshift(word & mask);
    }

    return bitArr;
};

function a2hex(arr) { return _.map(arr, function (a) { return (a >>> 0).toString(16); });}

var getAndShiftTopBits = function (wordArr, bits, totalBits) {
    var topBitIndex = totalBits - 1;
    var bottomBitIndex = totalBits - bits;
    var firstWordOffset = Math.floor(topBitIndex / 32);
    var lastWordOffset = Math.floor(bottomBitIndex / 32);
    
    /*console.log();
    console.log("TOT: %d  BITS: %d", totalBits, bits);
    console.log("FWO: %d  LWO: %d from %d-%d", firstWordOffset, lastWordOffset, topBitIndex, bottomBitIndex);*/

    var workingWordArr = wordArr;
    if (firstWordOffset > wordArr.length) {
        workingWordArr = wordArr.slice(); // Clone
        _.times(firstWordOffset - wordArr.length, function () { workingWordArr.unshift(0) });
    }

    var bitArr = workingWordArr.slice(workingWordArr.length -1 - firstWordOffset, workingWordArr.length - lastWordOffset);
    
    //console.log(a2hex(wordArr) + " => " + a2hex(bitArr));

    var shift = (totalBits - bits) % 32;
    var overflowMask = getBitMask(shift);
    
    // Mask out top bits that are > totalBits
    bitArr[0] &= getBitMask(totalBits % 32);
    
    var overflow = 0;
    for (var i = 0; i < bitArr.length; i++) {
        var word = bitArr[i];
        var newOverflow = word & overflowMask;
        //console.log("%s >>> %d + %s << %d", (word >>> 0).toString(16), shift, (overflow >>> 0).toString(16), 32 - shift);
        bitArr[i] = ((word >>> shift) + (overflow << (32 - shift))) >> 0;
        //console.log(" => %s", (bitArr[i] >>> 0).toString(16));
        overflow = newOverflow;
    }
    
    // Trim leading zeroes if necessary
    return bitArr.length > 1 && bitArr[0] == 0 ? bitArr.slice(1) : bitArr;
}

var getBitMask = function (bits) {
    return 0xFFFFFFFF >>> (32 - bits);
}

var bigIntToTuples = function (inputBigInt, seedTuples) {
    var dissipator = inputBigInt;
    var tuples = [];

    for (var i = seedTuples.length - 1; i >= 0; i--) {
        var tuple = seedTuples[i];
        
        var encryptedTuple;
        if (tuple.length == 1) {
            encryptedTuple = tuple;
        } else {
            var result = dissipator.divmod(tuple[1]); // Divide by tuple's base
            dissipator = result.quotient;
            
            encryptedTuple = [result.remainder.valueOf(), tuple[1], tuple[2]];
        }
            
        tuples.unshift(encryptedTuple);
    }

    return { tuples: tuples, remainder: dissipator };
};

// == Block object
function Block()
{
    this.tuples = [];
    this.encryptedTuples = [];
    this.encodedBigInt = bigInt.zero;
    this.remainder = bigInt.zero;
    this.encryptedBigInt = bigInt.zero;

    this.toWordArray = function () {
        return bigIntToWordArray(this.encodedBigInt);
    };

    this.encrypt = function (key, iv) {
        // Generate the encrypted base data
        var blockWords = bigIntToWordArray(this.encodedBigInt);
        var encrypted = cryptoJs.AES.encrypt(blockWords, key, { iv: iv, padding: cryptoJs.pad.ZeroPadding });
        
        this.cipherText = encrypted.ciphertext;
        this.encryptedBigInt = wordArrayToBigInt(encrypted.ciphertext);
        
        var result = bigIntToTuples(this.encryptedBigInt, this.tuples);

        this.encryptedTuples = result.tuples;
        this.remainder = result.remainder;

        return encrypted.ciphertext; // Next IV
    };

    this.decrypt = function (key, iv) {
        var blockWords = bigIntToWordArray(this.encryptedBigInt);
        
        var cipherParams = {
            ciphertext: blockWords
        };

        var decrypted = cryptoJs.AES.decrypt(cipherParams, key, { iv: iv, padding: cryptoJs.pad.ZeroPadding });

        this.encodedBigInt = wordArrayToBigInt(decrypted);

        var result = bigIntToTuples(this.encodedBigInt, this.encryptedTuples);

        this.tuples = result.tuples;
        this.remainder = result.remainder;

        return blockWords; // Next IV
    };
}

var blockifyTuples = function(tuples, blockPaddings) {
    var blockAcc = bigInt.one;
    var blockMax = bigInt(2).pow(BLOCK_MAX_BITS);
    //console.log(blockMax);
    
    var isEncrypted = blockPaddings !== undefined;

    var blocks = [new Block()];
    if (isEncrypted) {
        blocks[0].encryptedBigInt = blockPaddings[0];
    }

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
                
                if (isEncrypted) {
                    var lastBlockIndex = blocks.length - 1;
                    blocks[lastBlockIndex].encryptedBigInt = blockPaddings[lastBlockIndex];
                }

                lastBlock = _.last(blocks);
            }
            blockAcc = newBlockAcc;
            
            var encoded = isEncrypted ? lastBlock.encryptedBigInt : lastBlock.encodedBigInt;
            encoded = encoded.multiply(base).add(value);

            if (isEncrypted) {
                lastBlock.encryptedBigInt = encoded;
            } else {
                lastBlock.encodedBigInt = encoded;
            }
        }
        
        if (isEncrypted) {
            lastBlock.encryptedTuples.push(t);
        } else {
            lastBlock.tuples.push(t);
        }
    });

    return blocks;
}

var encryptString = function (inputString, password) {
    if (inputString.length == 0) {
        return '';
    }
    var encryptedString = '';
    var paddings = [];
    
    var tuples = stringToTuples(inputString);
    var blocks = blockifyTuples(tuples);

    var keys = keysForPassphrase(password);
    
    var iv = keys.iv;

    _.each(blocks, function (b) {
        // Cascade our IV to the next block
        iv = b.encrypt(iv, keys.key);

        encryptedString += tuplesToString(b.encryptedTuples);
        paddings.push(b.remainder);
    });

    return { encryptedString: encryptedString, blockPaddings: paddings };
}

var decryptString = function (encryptedString, blockPaddings, password) {
    if (encryptedString.length == 0) {
        return '';
    }

    var decryptedString = '';
    var paddings = [];
    
    // Transform to block array
    var tuples = stringToTuples(encryptedString);
    var blocks = blockifyTuples(tuples, blockPaddings);
    
    var keys = keysForPassphrase(password);
    
    var iv = keys.iv;
    
    _.each(blocks, function (b) {
        // Cascade our IV to the next block
        iv = b.decrypt(iv, keys.key);
        
        decryptedString += tuplesToString(b.tuples);
        paddings.push(b.remainder);
    });
    
    return { decryptedString: decryptedString, blockPaddings: paddings };

}

var PBKDF_ITERATIONS = 100; // Makes it take about 100ms on my i5 surface pro in node.js
var keysForPassphrase = function (password, iterations) {
    var salt = cryptoJs.SHA256(password);
    var key = cryptoJs.PBKDF2(password, salt, { keySize: BLOCK_MAX_BITS / 32, iterations: iterations || PBKDF_ITERATIONS });
    var iv = key;

    return { key: key, iv: iv };
}

/*
var blocks= blockify(stringToTuples(mixedString));
//console.log(blocks[0].encodedBigInt.toString());
//console.log(blocks[0]);

var wordArray = bigIntToWordArray(blocks[0].encodedBigInt);
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

// Internal bits for testing
// TODO: Only expose if passed in a 'test' parameter to constructor
exports.__privateFunctions = {
    charFor: charFor,
    charToTuple: charToTuple,
    stringToTuples: stringToTuples,
    tupleToChar: tupleToChar,
    tuplesToString: tuplesToString,
    
    bigIntToWordArray: bigIntToWordArray,
    wordArrayToBigInt: wordArrayToBigInt,
    
    getBottomBits: getBottomBits,
    getAndShiftTopBits: getAndShiftTopBits,

    blockifyTuples: blockifyTuples,
    
    rangesConfig: rangesConfig,

    keysForPassphrase: keysForPassphrase
};

// Public
exports.encryptString = encryptString;
exports.decryptString = decryptString;
