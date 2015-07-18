var assert = require('assert');
var funcrypt = require('../');

describe('Core Internal Function Tests', function() {
    it('charFor test', function () {
        var fpf = funcrypt.__privateFunctions;

        assert.equal(fpf.charFor('0'), 0x30, 'Zero == ASCII 0x30');
        assert.equal(fpf.charFor('a'), 0x61, 'Lower case latin a == ASCII 0x61');
        assert.equal(fpf.charFor('А'), 0x410, 'Cyrillic capital A == Unicode 0x0410');
        assert.equal(fpf.charFor('Я'), 0x42F, 'Cyrillic capital Я == Unicode 0x42F');
    })

    it('charToTuple test', function () {
        var fpf = funcrypt.__privateFunctions;
        
        // Test latin
        assert.deepEqual(fpf.charToTuple('a'), [0, 26], 'a => 0 base 26');
        assert.deepEqual(fpf.charToTuple('z'), [25, 26], 'z => 25 base 26');
        assert.deepEqual(fpf.charToTuple('A'), [0, 26], 'A => 0 base 26');
        assert.deepEqual(fpf.charToTuple('Z'), [25, 26], 'Z => 25 base 26');
        
        // Test cyrillic
        assert.deepEqual(fpf.charToTuple('а'), [0, 32], 'а (Cyrillic) => 0 base 32');
        assert.deepEqual(fpf.charToTuple('я'), [31, 32], 'я (Cyrillic) => 31 base 32');
        assert.deepEqual(fpf.charToTuple('А'), [0, 32], 'А (Cyrillic) => 0 base 32');
        assert.deepEqual(fpf.charToTuple('Я'), [31, 32], 'Я (Cyrillic) => 31 base 32');

        // Test unsupported
        assert.equal(fpf.charToTuple(' '), null, 'Whitespace unsupported');
        assert.equal(fpf.charToTuple('!'), null, 'Punctuation unsupported');
        assert.equal(fpf.charToTuple('#'), null, 'Punctuation unsupported');
    })
})
