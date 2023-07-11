//@ts-ignore
import secp256k1 from "secp256k1";
import { ethers } from "ethers";
import { DataItemCreateOptions, } from "arbundles";
import base64url from "base64url";
import { byteArrayToLong, getShim, getSignatureData, longTo8ByteArray, serializeTags, shortTo2ByteArray, sign } from "./utils";


export class Secp256k1 {
    readonly ownerLength: number = 65;
    readonly signatureLength: number = 65;

    readonly signatureType = 3;
    public readonly pk: string;

    constructor(protected _key: string, pk: Buffer) {
        this.pk = pk.toString("hex");
    }

    public get publicKey(): Buffer {
        return Buffer.alloc(0);
    }

    public get key(): Uint8Array {
        return Buffer.from(this._key, "hex");
    }

}

export class EthereumSigner extends Secp256k1 {
    get publicKey(): Buffer {
        return Buffer.from(this.pk, "hex");
    }

    constructor(key: string) {
        const b = Buffer.from(key, "hex");
        const pub = secp256k1.publicKeyCreate(b, false);
        super(key, Buffer.from(pub));
    }

    sign(message: Uint8Array): Uint8Array {
        console.log(this._key);
        const wallet = new ethers.Wallet(this._key/* slice(0, 32) */);
        return wallet
            .signMessage(message)
            .then((r) => Buffer.from(r.slice(2), "hex")) as any;
    }

}




export class DataItem {
    private readonly binary: Buffer;
    private _id!: Buffer;

    constructor(binary: Buffer) {
        this.binary = binary;
    }

    static isDataItem(obj: any): obj is DataItem {
        return obj.binary !== undefined;
    }

    get signatureType(): number {
        const signatureTypeVal: number = byteArrayToLong(
            this.binary.subarray(0, 2),
        );
        return signatureTypeVal;
    }

    // async isValid(): Promise<boolean> {
    //     return DataItem.verify(this.binary);
    // }
    //@ts-ignore
    get id(): string {
        return base64url.encode(this._id);
    }

    set id(id: string) {
        this._id = base64url.toBuffer(id);
    }
    //@ts-ignore
    get rawId(): Promise<Buffer> {
        return getShim("sha256").update(this.rawSignature).digest();
    }

    set rawId(id: Buffer) {
        this._id = id;
    }

    get rawSignature(): Buffer {
        return this.binary.subarray(2, 2 + this.signatureLength);
    }

    get signature(): string {
        return base64url.encode(this.rawSignature);
    }

    set rawOwner(pubkey: Buffer) {
        if (pubkey.byteLength != this.ownerLength)
            throw new Error(
                `Expected raw owner (pubkey) to be ${this.ownerLength} bytes, got ${pubkey.byteLength} bytes.`,
            );
        this.binary.set(pubkey, 2 + this.signatureLength);
    }

    get rawOwner(): Buffer {
        return this.binary.subarray(
            2 + this.signatureLength,
            2 + this.signatureLength + this.ownerLength,
        );
    }

    get signatureLength(): number {
        return 65;
    }

    get owner(): string {
        return base64url.encode(this.rawOwner);
    }

    get ownerLength(): number {
        return 65;
    }

    get rawTarget(): Buffer {
        const targetStart = this.getTargetStart();
        const isPresent = this.binary[targetStart] == 1;
        return isPresent
            ? this.binary.subarray(targetStart + 1, targetStart + 33)
            : Buffer.alloc(0);
    }

    get target(): string {
        return base64url.encode(this.rawTarget);
    }

    get rawAnchor(): Buffer {
        const anchorStart = this.getAnchorStart();
        const isPresent = this.binary[anchorStart] == 1;

        return isPresent
            ? this.binary.subarray(anchorStart + 1, anchorStart + 33)
            : Buffer.alloc(0);
    }

    get anchor(): string {
        return this.rawAnchor.toString();
    }

    get rawTags(): Buffer {
        const tagsStart = this.getTagsStart();
        const tagsSize = byteArrayToLong(
            this.binary.subarray(tagsStart + 8, tagsStart + 16),
        );
        return this.binary.subarray(tagsStart + 16, tagsStart + 16 + tagsSize);
    }

    // get tags(): { name: string; value: string; }[] {
    //     const tagsStart = this.getTagsStart();
    //     const tagsCount = byteArrayToLong(
    //         this.binary.subarray(tagsStart, tagsStart + 8),
    //     );
    //     if (tagsCount == 0) {
    //         return [];
    //     }

    //     const tagsSize = byteArrayToLong(
    //         this.binary.subarray(tagsStart + 8, tagsStart + 16),
    //     );

    //     return deserializeTags(
    //         Buffer.from(
    //             this.binary.subarray(tagsStart + 16, tagsStart + 16 + tagsSize),
    //         ),
    //     );
    // }

    // get tagsB64Url(): { name: string; value: string; }[] {
    //     const _tags = this.tags;
    //     return _tags.map((t) => ({
    //         name: base64url.encode(t.name),
    //         value: base64url.encode(t.value),
    //     }));
    // }

    getStartOfData(): number {
        const tagsStart = this.getTagsStart();

        const numberOfTagBytesArray = this.binary.subarray(
            tagsStart + 8,
            tagsStart + 16,
        );
        const numberOfTagBytes = byteArrayToLong(numberOfTagBytesArray);
        return tagsStart + 16 + numberOfTagBytes;
    }

    get rawData(): Buffer {
        const tagsStart = this.getTagsStart();

        const numberOfTagBytesArray = this.binary.subarray(
            tagsStart + 8,
            tagsStart + 16,
        );
        const numberOfTagBytes = byteArrayToLong(numberOfTagBytesArray);
        const dataStart = tagsStart + 16 + numberOfTagBytes;

        return this.binary.subarray(dataStart, this.binary.length);
    }

    get data(): string {
        return base64url.encode(this.rawData);
    }

    /**
     * UNSAFE!!
     * DO NOT MUTATE THE BINARY ARRAY. THIS WILL CAUSE UNDEFINED BEHAVIOUR.
     */
    getRaw(): Buffer {
        return this.binary;
    }

    public async sign(signer: EthereumSigner): Promise<Buffer> {
        this._id = await sign(this, signer);
        return this.rawId;
    }

    public async setSignature(signature: Buffer): Promise<void> {
        this.binary.set(signature, 2);
        this._id = Buffer.from(await crypto.subtle.digest("SHA-256", signature));
    }

    public isSigned(): boolean {
        return (this._id?.length ?? 0) > 0;
    }

    /**
     * Returns a JSON representation of a DataItem
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    // public toJSON(): {
    //     owner: string;
    //     data: string;
    //     signature: string;
    //     target: string;
    //     tags: { name: string; value: string; }[];
    // } {
    //     return {
    //         signature: this.signature,
    //         owner: this.owner,
    //         target: this.target,
    //         tags: this.tags.map((t) => ({
    //             name: base64url.encode(t.name),
    //             value: base64url.encode(t.value),
    //         })),
    //         data: this.data,
    //     };
    // }

    /**
     * Verifies a `Buffer` and checks it fits the format of a DataItem
     *
     * A binary is valid iff:
     * - the tags are encoded correctly
     */
    // static async verify(buffer: Buffer): Promise<boolean> {
    //     if (buffer.byteLength < MIN_BINARY_SIZE) {
    //         return false;
    //     }
    //     const item = new DataItem(buffer);
    //     const sigType = item.signatureType;
    //     const tagsStart = item.getTagsStart();

    //     const numberOfTags = byteArrayToLong(
    //         buffer.subarray(tagsStart, tagsStart + 8),
    //     );
    //     const numberOfTagBytesArray = buffer.subarray(
    //         tagsStart + 8,
    //         tagsStart + 16,
    //     );
    //     const numberOfTagBytes = byteArrayToLong(numberOfTagBytesArray);

    //     if (numberOfTagBytes > 4096) return false;

    //     if (numberOfTags > 0) {
    //         try {
    //             const tags: { name: string; value: string; }[] = deserializeTags(
    //                 Buffer.from(
    //                     buffer.subarray(tagsStart + 16, tagsStart + 16 + numberOfTagBytes),
    //                 ),
    //             );

    //             if (tags.length !== numberOfTags) {
    //                 return false;
    //             }
    //         } catch (e) {
    //             return false;
    //         }
    //     }

    //     // eslint-disable-next-line @typescript-eslint/naming-convention
    //     const Signer = EthereumSigner

    //     const signatureData = await getSignatureData(item);
    //     return await Signer.verify(item.rawOwner, signatureData, item.rawSignature);
    // }

    public async getSignatureData(): Promise<Uint8Array> {
        return getSignatureData(this);
    }

    /**
     * Returns the start byte of the tags section (number of tags)
     *
     * @private
     */
    private getTagsStart(): number {
        const targetStart = this.getTargetStart();
        const targetPresent = this.binary[targetStart] == 1;
        let tagsStart = targetStart + (targetPresent ? 33 : 1);
        const anchorPresent = this.binary[tagsStart] == 1;
        tagsStart += anchorPresent ? 33 : 1;

        return tagsStart;
    }

    /**
     * Returns the start byte of the tags section (number of tags)
     *
     * @private
     */
    private getTargetStart(): number {
        return 2 + this.signatureLength + this.ownerLength;
    }

    /**
     * Returns the start byte of the tags section (number of tags)
     *
     * @private
     */
    private getAnchorStart(): number {
        let anchorStart = this.getTargetStart() + 1;
        const targetPresent = this.binary[this.getTargetStart()] == 1;
        anchorStart += targetPresent ? 32 : 0;

        return anchorStart;
    }
}






export function createData(
    data: string | Uint8Array,
    signer: EthereumSigner,
    opts?: DataItemCreateOptions,
): DataItem {
    // TODO: Add asserts
    // Parse all values to a buffer and
    const _owner = signer.publicKey;

    const _target = opts?.target ? base64url.toBuffer(opts.target) : null;
    const target_length = 1 + (_target?.byteLength ?? 0);
    const _anchor = opts?.anchor ? Buffer.from(opts.anchor) : null;
    const anchor_length = 1 + (_anchor?.byteLength ?? 0);
    const _tags = (opts?.tags?.length ?? 0) > 0 ? serializeTags(opts?.tags) : null;
    const tags_length = 16 + (_tags ? _tags.byteLength : 0);
    const _data =
        typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    const data_length = _data.byteLength;

    // See [https://github.com/joshbenaron/arweave-standards/blob/ans104/ans/ANS-104.md#13-dataitem-format]
    const length =
        2 +
        signer.signatureLength +
        signer.ownerLength +
        target_length +
        anchor_length +
        tags_length +
        data_length;
    // Create array with set length
    const bytes = Buffer.alloc(length);

    bytes.set(shortTo2ByteArray(signer.signatureType), 0);
    // Push bytes for `signature`
    bytes.set(new Uint8Array(signer.signatureLength).fill(0), 2);
    // // Push bytes for `id`
    // bytes.set(EMPTY_ARRAY, 32);
    // Push bytes for `owner`

    if (_owner.byteLength !== signer.ownerLength)
        throw new Error(
            `Owner must be ${signer.ownerLength} bytes, but was incorrectly ${_owner.byteLength}`,
        );
    bytes.set(_owner, 2 + signer.signatureLength);

    const position = 2 + signer.signatureLength + signer.ownerLength;
    // Push `presence byte` and push `target` if present
    // 64 + OWNER_LENGTH
    bytes[position] = _target ? 1 : 0;
    if (_target) {
        if (_target.byteLength !== 32)
            throw new Error(
                `Target must be 32 bytes but was incorrectly ${_target.byteLength}`,
            );
        bytes.set(_target, position + 1);
    }

    // Push `presence byte` and push `anchor` if present
    // 64 + OWNER_LENGTH
    const anchor_start = position + target_length;
    let tags_start = anchor_start + 1;
    bytes[anchor_start] = _anchor ? 1 : 0;
    if (_anchor) {
        tags_start += _anchor.byteLength;
        if (_anchor.byteLength !== 32) throw new Error("Anchor must be 32 bytes");
        bytes.set(_anchor, anchor_start + 1);
    }

    bytes.set(longTo8ByteArray(opts?.tags?.length ?? 0), tags_start);
    const bytesCount = longTo8ByteArray(_tags?.byteLength ?? 0);
    bytes.set(bytesCount, tags_start + 8);
    if (_tags) {
        bytes.set(_tags, tags_start + 16);
    }

    const data_start = tags_start + tags_length;

    bytes.set(_data, data_start);

    return new DataItem(bytes);
}


export * from "./deephash";
export * from "./utils";