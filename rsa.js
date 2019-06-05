// p = 311
// q = 503
var bigInt = require("big-integer");
var p = 311
var q = 503
var n = p*q
var totient = (p-1) * (q-1)
var PublicKEY = get_public_key(totient)
var privateKEY = get_private_key(PublicKEY, totient)

function gcd(a, b){
    var temp;
    while (b != 0){
        temp = a
        a = b;
        b = temp % b
    }
   return a
}
function decrypt(pk, ciphertext){
    const{key, n} = pk 
    let plain = []
    for(var char of ciphertext){
        plain.push(String.fromCharCode(bigInt(char).modPow(key, n)))
    }
    return plain.join('')
}

function get_private_key(e, tot){
    d = 1
   while ((e * d) % tot != 1 || d == e)
      d += 1
   return d
}

function get_public_key(tot){
    e = 2
   while(e < totient && gcd(e, totient) != 1)
      e += 1
   return e
}
module.exports={
    decrypt,
    n,
    PublicKEY,
    privateKEY
}