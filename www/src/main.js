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

var decode = function(input) {
    // Replace non-url compatible chars with base64 standard chars
    input = input
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    // Pad out with standard base64 required padding characters
    var pad = input.length % 4;
    if(pad) {
      if(pad === 1) {
        throw new Error('InvalidLengthError: Input base64url string is the wrong length to determine padding');
      }
      input += new Array(5-pad).join('=');
    }

    return window.atob(input);
}


setStatusString("loaded")

async function loadKey() {
    setStatusString("requesting key")
    createResponse = await fetch('https://api.sealed.fyi/test', {
        headers: {
            'Content-Type': 'text/plain'
        },
        method: 'POST'
    })

    setStatusString("got key")
    createResponse = await createResponse.json()


    setStatusString("parsed json") 
    console.log(createResponse)   
    const id = createResponse.id
    const password = createResponse.password
    const pem = decode(createResponse.key).trim()
    console.log(pem)
    const pemHeader = "-----BEGIN RSA PUBLIC KEY-----";
    const pemFooter = "-----END RSA PUBLIC KEY-----";
    const pemContents = pem.substring(pemHeader.length, pem.length - pemFooter.length);
    // base64 decode the string to get the binary data
    const binaryDerString = window.atob(pemContents);
    // convert from a binary string to an ArrayBuffer
    const binaryDer = str2ab(binaryDerString);

    publicKey = await window.crypto.subtle.importKey(
        "spki",
        binaryDer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        true,
        ["encrypt"])

    setStatusString("imported key")

    return [id, password, publicKey]
}

loadKey().then(([id, password, publicKey]) => {
    setStatusString("imported id: " + id)
}).catch(function(err) {
    setStatusString("error")
    console.log(err)
}); 