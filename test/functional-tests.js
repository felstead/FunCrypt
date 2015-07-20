var assert = require('assert');
var funcrypt = require('../src');
var _ = require('underscore');

describe('Functionals', function () {
    var fpf = funcrypt.__privateFunctions;
    
    var shortString = "Testing testing let's GO 123!";

    it('should be able to encrypt/decrypt a short string', function () {
        var password = "Password";
        var encResult = funcrypt.encryptString(shortString, password);
        var decResult = funcrypt.decryptString(encResult.encryptedString, encResult.blockPaddings, password);
        
        assert.equal(shortString, decResult.decryptedString, "String should decrypt to the same string: " + shortString + " => " + decResult.decryptedString);
    });

    it('should be able to encrypt/decrypt a variety of strings', function () {
        // TODO
    });

    it('should maintain casing between encrypted and decrypted', function () {
        // TODO
    });

    it('should make the character distribution uniform', function () {
        // TODO
    });
});
