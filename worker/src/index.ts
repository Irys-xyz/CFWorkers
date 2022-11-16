import "node-window-polyfill/register";
import { SolanaBundlr } from "@bundlr-network/solana-web";
import { sign } from "@noble/ed25519";
import bs58 from "bs58";
import fetchAdapter from "@vespaiach/axios-fetch-adapter";
import { setIsBrowser } from "@bundlr-network/client/common";

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		try {
			// these can be pre-derived and hardcoded as an env var. (encode as hex string, store in .env, decode here.)
			const key = bs58.decode("...");
			const priv = key.subarray(0, 32);
			const pub = key.subarray(32, 64);

			const providerShim = {
				publicKey: {
					toBuffer: () => pub,
					byteLength: 32
				},
				signMessage: async (message: Uint8Array) => {
					return await sign(Buffer.from(message), priv);
				},

			};

			const nodeUrl = "https://devnet.bundlr.network";
			setIsBrowser(true);
			//@ts-ignore
			const b = new SolanaBundlr(nodeUrl, providerShim, { api: { adapter: fetchAdapter } });
			await b.ready();

			const tx = b.createTransaction("Hello world!");
			await tx.sign();
			console.log("Tx is valid?", await tx.isValid());

			const res = await tx.upload();

			console.log(JSON.stringify(res));

			return new Response(JSON.stringify(res));
		} catch (e) {
			console.log(e);
			console.log("ERROR", JSON.stringify(e));
			return new Response("");
		}
	},
};