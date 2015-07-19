# FunCrypt

A format-preserving-encryption (though not _truly_ format preserving as we have some hidden padding) system for encrypting 
textual data, but maintaining the casing and whatnot.  This is for fun only, don't use it to encrypt anything important --
while the encryption algorithm should be pretty solid (assuming crypto JS is) I would imagine that the case and spacing
preservation reveals much-too-much in the way of plaintext information, so my guess is that any sufficiently motivated
cryptanalyst would be pretty likely to be able to make some strong guesses at the text.  That said, I'm not anything close
to being a crypto guy, so who knows, it might be fine.

Best to use it just for fun though.

Still a work in progress.

## Example Encryption
An example :
"The quick brown Фокс jumped over the lazy собака"

Encrypts to:
"The quick brown Фокс jumped over the lazy собака"

## Supported Encodings

Currently supported:
* Latin
* Latin numeric
* Cyrillic

Want to support:
* Emoji
* Simplified Chinese (character ranges based on root radicals maybe?)

Only tested on UTF-8.  If you use another encoding, you're on your own.

## How it works
We use crypto-js (LINK) for the actual encryption (symmetric AES with a 128 bit key) and encode the text in blocks of
big integers as mixed radix numbers (LINK).