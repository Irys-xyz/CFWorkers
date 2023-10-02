import "node-window-polyfill/register";
import {  SolanaSigner, createData } from "../../module";

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

			const url = "http://node2.bundlr.network"
			const key = "..." // your solana private key string here (pls add to env in prod)

			const signer = new SolanaSigner(key);
			
			//upload example
			const di = createData("Hello, Bundlr!", signer, { tags: [{ name: "content-type", value: "text/plain" }] });
			await di.sign(signer);
		
			const res = await fetch(`${url}/tx/arweave`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: di.getRaw() });
			return res;

		} catch (e) {
			console.log(e);
			console.log("ERROR", JSON.stringify(e));
			return new Response("");
		}
	},
};
