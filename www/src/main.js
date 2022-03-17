function str2ab(str) {
    var arrBuff = new ArrayBuffer(str.length);
    var bytes = new Uint8Array(arrBuff);
    for (var iii = 0; iii < str.length; iii++) {
        bytes[iii] = str.charCodeAt(iii);
    }
    return bytes;
}

function setStatusString(str) {
    $("#status").text(str)
}

setStatusString("loaded")

fetch('https://api.sealed.fyi/test', {
    headers: {
        'Content-Type': 'text/plain'
    },
    method: 'POST'
})
.then((response) => {
    setStatusString("got key")
    return response.json()
})
.then((response) => {
    setStatusString("parsed json")
    // fetch the part of the PEM string between header and footer
    const pem = response.key.trim()
    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = pem.substring(pemHeader.length, pem.length - pemFooter.length);
    // base64 decode the string to get the binary data
    const binaryDerString = window.atob(pemContents);
    // convert from a binary string to an ArrayBuffer
    const binaryDer = str2ab(binaryDerString);

    return window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    {
        name: "RSA-OAEP",
        hash: "SHA-256"
    },
    true,
    ["encrypt"])
}).then(function(publicKey){
    setStatusString("imported key")
    return crypto.subtle.encrypt(
        {
        name: "RSA-OAEP"
        },
        publicKey,
        str2ab("hello-world")
        );
        
}).then(function(data){
    setStatusString("encrypted data")
    console.log(data)
}).catch(function(err) {
    setStatusString("error")
    console.log(err );
}); 