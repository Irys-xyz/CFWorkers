import "node-window-polyfill/register";
import { EthereumSigner, createData } from "../../module";
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

			const key = "...";
			const signer = new EthereumSigner(key);
			const di = createData("Hello, Bundlr!", signer, { tags: [{ name: "content-type", value: "text/plain" }] });
			await di.sign(signer);
			console.log(di.id);
			const res = await fetch("http://node2.bundlr.network/tx/matic", { method: "POST", headers: { "content-type": "application/octet-stream" }, body: di.getRaw() });
			return res;

		} catch (e) {
			console.log(e);
			console.log("ERROR", JSON.stringify(e));
			return new Response("");
		}
	},
};
