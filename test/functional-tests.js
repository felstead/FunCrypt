var assert = require('assert');
var funcrypt = require('../src');
var _ = require('underscore');
var fs = require('fs');

// To handle mocha cmdline runs and VS runs
var testCorpus = fs.existsSync('test-corpus.txt') ? 'test-corpus.txt' : 'test/test-corpus.txt';

describe('Functionals', function () {
    var fpf = funcrypt.__privateFunctions;
    
    var shortString = "Testing testing let's GO 123!";

    it('should be able to encrypt/decrypt a short string', function () {
        var password = "Password";
        var encResult = funcrypt.encryptString(shortString, password);
        var decResult = funcrypt.decryptString(encResult.encryptedString, encResult.blockPaddings, password);
        
        assert.equal(shortString, decResult.decryptedString, "String should decrypt to the same string: " + shortString + " => " + decResult.decryptedString);
    });

    it('should be able to encrypt/decrypt a variety of strings', function (done) {
        fs.readFile(testCorpus, 'utf8', function (err, data) {
            assert.ok(err == null, "File should load");
            var lines = data.split('\n');
            _.each(lines, function (line) {
                var password = "Password";
                var encResult = funcrypt.encryptString(line, password);
                var decResult = funcrypt.decryptString(encResult.encryptedString, encResult.blockPaddings, password);
                
                // Debugging to see what they look like
                /*console.log("= Original:");
                console.log(l);
                console.log("= Encrypted:");
                console.log(encResult.encryptedString);
                console.log("===");
                console.log("");*/

                assert.equal(line, decResult.decryptedString, "String should decrypt to the same string: " + line + " => " + decResult.decryptedString);
            });
            done();
        });
    });
    
    it('should encrypt/decrypt a big-ass string', function (done) {
        fs.readFile(testCorpus, 'utf8', function (err, data) {
            assert.ok(err == null, "File should load");
            
            var password = "Password";
            var encResult = funcrypt.encryptString(data, password);
            var decResult = funcrypt.decryptString(encResult.encryptedString, encResult.blockPaddings, password);
            
            assert.equal(data, decResult.decryptedString, "String should decrypt to the same string");
            
            done();
        });
    });

    it('should maintain casing between encrypted and decrypted', function (done) {
        fs.readFile(testCorpus, 'utf8', function (err, data) {
            assert.ok(err == null, "File should load: " + err);

            var password = "Password";
            var encResult = funcrypt.encryptString(data, password);
            var encStr = encResult.encryptedString;

            assert.equal(data.length, encStr.length, "Encrypted and original string should be the same length");
            
            _.each(encStr, function (c, i) {
                var ptTuple = funcrypt.__privateFunctions.charToTuple(c);
                var encTuple = funcrypt.__privateFunctions.charToTuple(encStr[i]);
                
                assert.equal(ptTuple.length, encTuple.length, "All tuples should match in length");
                if (ptTuple.length > 1) {
                    assert.equal(ptTuple[1], encTuple[1], "Base should be the same for character " + c + ": " + ptTuple[1] + " => " + encTuple[1]);
                    assert.equal(ptTuple[2], encTuple[2], "Group should be the same for character " + c + ": " + ptTuple[2] + " => " + encTuple[2]);
                }
            });

            done();
        });
    });

    it('should make the character distribution uniform', function () {
        // TODO
    });
});
