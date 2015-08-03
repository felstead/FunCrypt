var assert = require('assert');
var funcrypt = require('../src');
var _ = require('underscore');
var bigInt = require('big-integer');
var cryptoJs = require('crypto-js');

describe('Internals', function () {
    
    var latinString = "The quick brown fox jumped over the lazy dog.";
    var longerLatinString = "BigInteger.js is an arbitrary - length integer library for Javascript, allowing arithmetic operations on integers of unlimited size, notwithstanding memory and time limitations.";
    var mixedString = "The quick brown Фокс jumped over the lazy собака";
    var mixedString2 = "The number π is a mathematical constant, the ratio of a circle s circumference to its diameter, commonly approximated as 3.14159. It has been represented by the Greek letter 'π'";

    var allStrings = [latinString, longerLatinString, mixedString, mixedString2];
    
    var fpf = funcrypt.__privateFunctions;

    var numStrings = [
        "1133557799bbddff0022446688aaccee", // 128 bit number
        "1234567890abcdeffedcba0987654321", // another 128-bit
        "1133557799bbddff0022446688aa", // 112-bit
        "33557799bbddff002244668", // 84-bit
        "557799bbddff00", // 64 bit
        "1234567890", //40-bit
        "1234" //16 bit
    ];
    it('need charFor', function () {
        assert.equal(fpf.charFor('0'), 0x30, 'Zero == ASCII 0x30');
        assert.equal(fpf.charFor('a'), 0x61, 'Lower case latin a == ASCII 0x61');
        assert.equal(fpf.charFor('А'), 0x410, 'Cyrillic capital A == Unicode 0x0410');
        assert.equal(fpf.charFor('Я'), 0x42F, 'Cyrillic capital Я == Unicode 0x42F');
    })

    it('need charToTuple', function () {
        // TODO: Move to map
        var latinLower = _.findIndex(fpf.rangesConfig, function (c) { return c.name == 'latinLower'; });
        var latinUpper = _.findIndex(fpf.rangesConfig, function (c) { return c.name == 'latinUpper'; });
        var cyrLower = _.findIndex(fpf.rangesConfig, function (c) { return c.name == 'cyrillicLower'; });
        var cyrUpper = _.findIndex(fpf.rangesConfig, function (c) { return c.name == 'cyrillicUpper'; });
        var numeric = _.findIndex(fpf.rangesConfig, function (c) { return c.name == 'numeric'; });

        // Test latin
        assert.deepEqual(fpf.charToTuple('a'), [0, 26, latinLower], 'a => 0 base 26');
        assert.deepEqual(fpf.charToTuple('z'), [25, 26, latinLower], 'z => 25 base 26');
        assert.deepEqual(fpf.charToTuple('A'), [0, 26, latinUpper], 'A => 0 base 26');
        assert.deepEqual(fpf.charToTuple('Z'), [25, 26, latinUpper], 'Z => 25 base 26');
        
        // Test cyrillic
        assert.deepEqual(fpf.charToTuple('а'), [0, 32, cyrLower], 'а (Cyrillic) => 0 base 32');
        assert.deepEqual(fpf.charToTuple('я'), [31, 32, cyrLower], 'я (Cyrillic) => 31 base 32');
        assert.deepEqual(fpf.charToTuple('А'), [0, 32, cyrUpper], 'А (Cyrillic) => 0 base 32');
        assert.deepEqual(fpf.charToTuple('Я'), [31, 32, cyrUpper], 'Я (Cyrillic) => 31 base 32');
        
        // Test numeric
        assert.deepEqual(fpf.charToTuple('0'), [0, 10, numeric], '0 => 0 base 10');
        assert.deepEqual(fpf.charToTuple('9'), [9, 10, numeric], '9 => 9 base 10');

        // Test unsupported
        assert.deepEqual(fpf.charToTuple(' '), [' '], 'Whitespace unsupported');
        assert.deepEqual(fpf.charToTuple('\t'), ['\t'], 'Whitespace unsupported');
        assert.deepEqual(fpf.charToTuple('\n'), ['\n'], 'Whitespace unsupported');
        assert.deepEqual(fpf.charToTuple('!'), ['!'], 'Punctuation unsupported');
        assert.deepEqual(fpf.charToTuple('#'), ['#'], 'Punctuation unsupported');
    })

    it('should be able to encode and decode string/tuple pairs', function () {
        _.each(allStrings, function (s) {
            var tupleArray = fpf.stringToTuples(s);
            assert.equal(s.length, tupleArray.length, "String and tuple arrays should be of same length for string " + s);

            var decodedString = fpf.tuplesToString(tupleArray);
            assert.equal(s, decodedString, "String and decoded string should be equal for string " + s);

        });
    })
    
    it('should be able to do mixed radix conversion', function () {
        var testString = 'c7ЯA'; // This is 2b26,7b10,31b32,0b26 => ((((2) * 10 + 7) * 32 + 31) * 26 + 0) = 23,270
        var tuples = fpf.stringToTuples(testString);
        var blocks = fpf.blockifyTuples(tuples);
        
        assert.equal(1, blocks.length, "Should be only one block");
        assert.equal('23270', blocks[0].encodedBigInt.toString(), "Should encode to 23,270");
    });

    it('should be able to blockify a tuple array', function () {
        var blockMaxString = '34028236692093846346337460743176821145'; // All digits for 2^128 except last
        var blockMaxStringPlusExtra = '340282366920938463463374607431768211456'; // 2^128
      
        // Should be a single block
        var tuples = fpf.stringToTuples(blockMaxString);
        var blocks = fpf.blockifyTuples(tuples);
        assert.equal(1, blocks.length, "Should be a single block for 2^128 / 10");
        assert.equal(blockMaxString, blocks[0].encodedBigInt.toString(), "Encoded should be equal to original for numeric");

        // Should be two blocks
        tuples = fpf.stringToTuples(blockMaxStringPlusExtra);
        blocks = fpf.blockifyTuples(tuples);
        assert.equal(2, blocks.length, "Should be two blocks for 2^128");
        assert.equal(blockMaxString, blocks[0].encodedBigInt.toString(), "Encoded should be equal to original / 10 for numeric");
        assert.equal('6', blocks[1].encodedBigInt.toString(), "Encoded should be equal to final digit for numeric");
    });

    it('should be able to encode/decode word arrays', function () {
        _.each(numStrings, function (ns) {
            var bigNum = bigInt(ns, 16);

            var wordArray = fpf.bigIntToWordArray(bigNum);
            
            var decoded = fpf.wordArrayToBigInt(wordArray);
            var decodedString = decoded.toString(16)

            assert.equal(ns, decodedString, "Encoding/decoding should be symmetric for 0x" + ns + " => 0x" + decodedString);
        });

        // We can use this to stress the function a bit if we need to
        /*
        var randMax = bigInt(2).pow(128).subtract(1);
        _.times(10000, function () {
            var bigNum = bigInt.randBetween(0, randMax);
            var bigNumStr = bigNum.toString(16);

            var wordArray = fpf.bigIntToWordArray(bigNum);
            
            var decoded = fpf.wordArrayToBigInt(wordArray);
            var decodedString = decoded.toString(16);
            
            assert.equal(bigNumStr, decodedString, "Encoding/decoding should be symmetric for 0x" + bigNumStr + " => 0x" + decodedString);
        });*/
    });

    it('should be able to encrypt and decrypt word arrays built from bigints', function () {
        _.each(numStrings, function (ns) { 
            
            var wordArray = fpf.bigIntToWordArray(bigInt(ns, 16));
            
            var keys = fpf.keysForPassphrase("Secret password");

            var encrypted = cryptoJs.AES.encrypt(wordArray, keys.key, { iv: keys.iv, padding: cryptoJs.pad.ZeroPadding });
            
            var decrypted = cryptoJs.AES.decrypt(encrypted, keys.key, { iv: keys.iv, padding: cryptoJs.pad.ZeroPadding });

            var decryptedBigInt = fpf.wordArrayToBigInt(decrypted);
            var decryptedString = decryptedBigInt.toString(16);

            assert.equal(ns, decryptedString, "String should encrypt and decrypt to the same value: " + ns + " => " + decryptedString);

        });
    });

    it('should correctly blockify and decrypt an encrypted string and its blocks', function () {
        var password = "Password";
        var unencrypted = "Testing testing let's GO 123!";
        var encrypted = "Cnqqerx dfboqsq aoq'x GR 705!";
        var blockPadding = [bigInt(12679323)];

        var key = fpf.keysForPassphrase(password);

        var encryptedBlocks = fpf.blockifyTuples(fpf.stringToTuples(encrypted), blockPadding);
        var unencryptedBlocks = fpf.blockifyTuples(fpf.stringToTuples(unencrypted));

        assert.equal(1, encryptedBlocks.length, "Should only be a single block");
        assert.equal(encrypted.length, encryptedBlocks[0].encryptedTuples.length, "Should have encrypted tuples of length " + encrypted.length);
        
        encryptedBlocks[0].decrypt(key.key, key.iv);

        assert.equal(encryptedBlocks[0].encodedBigInt.toString(16), unencryptedBlocks[0].encodedBigInt.toString(16), "Should have the same encoded int");

        var decrypted = fpf.tuplesToString(encryptedBlocks[0].tuples);
        assert.equal(unencrypted, decrypted, "Encrypted string should decrypt to original: " + unencrypted + " => " + decrypted);
    });
    
    // crypto-js expects signed integers, so we ensure we make sure the hex goes to its signed representation
    var signifyArray = function (arr) {
        return _.map(arr, function (e) { return e >> 0 });
    }

    it('should be able to grab the bottom bit slices of word arrays', function () {
        var testWordArr = signifyArray([0x12345678, 0x9ABCDEF0, 0xDEADBEEF]);

        // Test 32 bit chunks
        var bottom32 = fpf.getBottomBits(testWordArr, 32);
        assert.deepEqual(bottom32, signifyArray([0xDEADBEEF]));

        var bottom64 = fpf.getBottomBits(testWordArr, 64);
        assert.deepEqual(bottom64, signifyArray([0x9ABCDEF0, 0xDEADBEEF]));

        var bottom96 = fpf.getBottomBits(testWordArr, 96);
        assert.deepEqual(bottom96, signifyArray([0x12345678, 0x9ABCDEF0, 0xDEADBEEF]));
        
        // Overflow - tests padding
        var bottom128 = fpf.getBottomBits(testWordArr, 128);
        assert.deepEqual(bottom128, signifyArray([0, 0x12345678, 0x9ABCDEF0, 0xDEADBEEF]));

        // Test fractions
        var bottom3 = fpf.getBottomBits(testWordArr, 3);
        assert.deepEqual(bottom3, signifyArray([0x7]));

        var bottom6 = fpf.getBottomBits(testWordArr, 6);
        assert.deepEqual(bottom6, signifyArray([0x2F]));

        var bottom43 = fpf.getBottomBits(testWordArr, 43);
        assert.deepEqual(bottom43, signifyArray([0x6F0, 0xDEADBEEF]));

        // Overflow with fraction
        var bottom97 = fpf.getBottomBits(testWordArr, 97);
        assert.deepEqual(bottom97, signifyArray([0, 0x12345678, 0x9ABCDEF0, 0xDEADBEEF]));
    });

    it('should be able to grab the top bit slices of word arrays', function () {
        var testWordArr = signifyArray([0x12345678, 0x9ABCDEF0, 0xDEADBEEF]);
        
        // Test 32 bit chunks
        var top32 = fpf.getAndShiftTopBits(testWordArr, 32, 96);
        assert.deepEqual(top32, signifyArray([0x12345678]));

        top32 = fpf.getAndShiftTopBits(testWordArr, 32, 64);
        assert.deepEqual(top32, signifyArray([0x9ABCDEF0]));

        top32 = fpf.getAndShiftTopBits(testWordArr, 32, 128);
        assert.deepEqual(top32, signifyArray([0x0]));

        // Test various offsets
        var top16 = fpf.getAndShiftTopBits(testWordArr, 16, 32);
        assert.deepEqual(top16, signifyArray([0xDEAD]));

        top16 = fpf.getAndShiftTopBits(testWordArr, 16, 48);
        assert.deepEqual(top16, signifyArray([0xDEF0]));

        top16 = fpf.getAndShiftTopBits(testWordArr, 16, 72);
        assert.deepEqual(top16, signifyArray([0x789A]));

        // Test multiple word selections
        var top40 = fpf.getAndShiftTopBits(testWordArr, 40, 96);
        assert.deepEqual(top40, signifyArray([0x12, 0x3456789A]));

        top40 = fpf.getAndShiftTopBits(testWordArr, 40, 48);
        assert.deepEqual(top40, signifyArray([0xDE, 0xF0DEADBE]));

        top71 = fpf.getAndShiftTopBits(testWordArr, 71, 90);
        assert.deepEqual(top71, signifyArray([0x46, 0x8ACF1357, 0x9BDE1BD5]));
    });

});
