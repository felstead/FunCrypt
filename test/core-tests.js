var assert = require('assert');
var funcrypt = require('../src');
var _ = require('underscore');
var bigInt = require('big-integer');

describe('Internals', function () {
    
    var latinString = "The quick brown fox jumped over the lazy dog.";
    var longerLatinString = "BigInteger.js is an arbitrary - length integer library for Javascript, allowing arithmetic operations on integers of unlimited size, notwithstanding memory and time limitations.";
    var mixedString = "The quick brown Фокс jumped over the lazy собака";
    var mixedString2 = "The number π is a mathematical constant, the ratio of a circle s circumference to its diameter, commonly approximated as 3.14159. It has been represented by the Greek letter 'π'";
    
    var allStrings = [latinString, longerLatinString, mixedString, mixedString2];

    it('needs charFor', function () {
        var fpf = funcrypt.__privateFunctions;

        assert.equal(fpf.charFor('0'), 0x30, 'Zero == ASCII 0x30');
        assert.equal(fpf.charFor('a'), 0x61, 'Lower case latin a == ASCII 0x61');
        assert.equal(fpf.charFor('А'), 0x410, 'Cyrillic capital A == Unicode 0x0410');
        assert.equal(fpf.charFor('Я'), 0x42F, 'Cyrillic capital Я == Unicode 0x42F');
    })

    it('needs charToTuple', function () {
        var fpf = funcrypt.__privateFunctions;
        
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

    it('needs to be able to encode and decode string/tuple pairs', function () {
        var fpf = funcrypt.__privateFunctions;

        _.each(allStrings, function (s) {
            var tupleArray = fpf.stringToTuples(s);
            assert.equal(s.length, tupleArray.length, "String and tuple arrays should be of same length for string " + s);

            var decodedString = fpf.tuplesToString(tupleArray);
            assert.equal(s, decodedString, "String and decoded string should be equal for string " + s);

        });
    })
    
    it('should be able to do mixed radix conversion', function () {
        var fpf = funcrypt.__privateFunctions;

        var testString = 'c7ЯA'; // This is 2b26,7b10,31b32,0b26 => ((((2) * 10 + 7) * 32 + 31) * 26 + 0) = 23,270
        var tuples = fpf.stringToTuples(testString);
        var blocks = fpf.blockifyTuples(tuples);
        
        assert.equal(1, blocks.length, "Should be only one block");
        assert.equal('23270', blocks[0].encoded.toString(), "Should encode to 23,270");
    });

    it('should be able to blockify a tuple array', function () {
        var fpf = funcrypt.__privateFunctions;
        
        var blockMaxString = '34028236692093846346337460743176821145'; // All digits for 2^128 except last
        var blockMaxStringPlusExtra = '340282366920938463463374607431768211456'; // 2^128
      
        // Should be a single block
        var tuples = fpf.stringToTuples(blockMaxString);
        var blocks = fpf.blockifyTuples(tuples);
        assert.equal(1, blocks.length, "Should be a single block for 2^128 / 10");
        assert.equal(blockMaxString, blocks[0].encoded.toString(), "Encoded should be equal to original for numeric");

        // Should be two blocks
        tuples = fpf.stringToTuples(blockMaxStringPlusExtra);
        blocks = fpf.blockifyTuples(tuples);
        assert.equal(2, blocks.length, "Should be two blocks for 2^128");
        assert.equal(blockMaxString, blocks[0].encoded.toString(), "Encoded should be equal to original / 10 for numeric");
        assert.equal('6', blocks[1].encoded.toString(), "Encoded should be equal to final digit for numeric");
    });
});
