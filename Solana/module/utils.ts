import deepHash from "./deephash";
import { SolanaSigner, DataItem } from "./index";

const map = {
    "sha256": "SHA-256",
    "sha384": "SHA-384"
};

//@ts-ignore
Object.entries(map).forEach(([k, v]) => { map[v] = k; });


export async function sign(item: DataItem, signer: SolanaSigner): Promise<Buffer> {
    const { signature, id } = await getSignatureAndId(item, signer);
    item.getRaw().set(signature, 2);
    return id;
}

export async function getSignatureAndId(
    item: DataItem,
    signer: SolanaSigner,
): Promise<{ signature: Buffer; id: Buffer; }> {
    const signatureData = await getSignatureData(item);

    const signatureBytes = await signer.sign(signatureData);
    console.log(signer.publicKey, signatureData, signatureBytes)
    const valid = await SolanaSigner.verify(signer.publicKey, signatureData, signatureBytes)
    const idBytes = await crypto.subtle.digest("SHA-256", signatureBytes);

    return { signature: Buffer.from(signatureBytes), id: Buffer.from(idBytes) };
}


export async function getSignatureData(item: DataItem): Promise<Uint8Array> {
    return deepHash([
        Buffer.from("dataitem", "utf-8"),
        Buffer.from("1", "utf-8"),
        Buffer.from(item.signatureType.toString(), "utf-8"),
        item.rawOwner,
        item.rawTarget,
        item.rawAnchor,
        item.rawTags,
        item.rawData,
    ]);
}




const shimClass = class {
    context = [];
    //@ts-ignore
    constructor(private algo) { this.context = []; };
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    update(data: Buffer) {
        //@ts-ignore
        this.context.push(data);
        return this;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    async digest() { return Buffer.from(await crypto.subtle.digest(this.algo, Buffer.concat(this.context))); }
};

export function getShim(algo: string) {
    //@ts-ignore
    algo = (algo.includes("-")) ? algo : algo = map[algo];
    return new shimClass(algo);
}


export function byteArrayToLong(byteArray: Uint8Array): number {
    let value = 0;
    for (let i = byteArray.length - 1; i >= 0; i--) {
        value = value * 256 + byteArray[i];
    }
    return value;
}




export function longTo8ByteArray(long: number): Uint8Array {
    // we want to represent the input as a 8-bytes array
    const byteArray = [0, 0, 0, 0, 0, 0, 0, 0];

    for (let index = 0; index < byteArray.length; index++) {
        const byte = long & 0xff;
        byteArray[index] = byte;
        long = (long - byte) / 256;
    }

    return Uint8Array.from(byteArray);
}

export function shortTo2ByteArray(long: number): Uint8Array {
    if (long > (2 ^ (32 - 1))) throw new Error("Short too long");
    // we want to represent the input as a 8-bytes array
    const byteArray = [0, 0];

    for (let index = 0; index < byteArray.length; index++) {
        const byte = long & 0xff;
        byteArray[index] = byte;
        long = (long - byte) / 256;
    }

    return Uint8Array.from(byteArray);
}


