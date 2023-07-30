import "node-window-polyfill/register";
import { ArweaveSigner, createData } from "../../module";
import Arweave from "arweave/web"
import fetchAdapter from "@vespaiach/axios-fetch-adapter"
import axios from "axios"
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
			const key = {
				"kty": "",
				"e": "",
				"n": "",
				"d": "",
				"p": "",
				"q": "",
				"dp": "",
				"dq": "",
				"qi": ""
			  } 

			const signer = new ArweaveSigner(key);
			
			//upload example
			const di = createData("Hello, Bundlr!", signer, { tags: [{ name: "content-type", value: "text/plain" }] });
			await di.sign(signer);

			const price = (await (await fetch(`${url}/price/arweave/${di.getRaw().byteLength}`)).json<string>())

			// funding example
			const target = (await (await fetch(url, {method: "GET"})).json<{addresses: {arweave: string}}>()).addresses.arweave // or hardcode as `ZE0N-8P9gXkhtK-07PQu9d8me5tGDxa_i4Mee5RzVYg`
			const arweave = Arweave.init({host: "arweave.net", protocol: "http", port: "80"})
			// const address = await arweave.wallets.getAddress(key)
			// console.log(address)
			arweave.api.request = function () {
				const instance = axios.create({
					baseURL: `${this.config.protocol}://${this.config.host}:${this.config.port}`,
            		timeout: this.config.timeout,
            		maxContentLength: 1024 * 1024 * 512,
            		headers: {},
					adapter: fetchAdapter
				})
				return instance
			}

			const tx = await arweave.createTransaction({quantity: price.toString(), target }, key)
			await arweave.transactions.sign(tx,key)
			console.log("Funding with Tx", tx.id)

			const fundingStatus = await arweave.transactions.post(tx)

			// register Tx with bundlr - note: can take 30+ minutes to confirm and apply to your bundlr balance (due to arweave's long block times), so funding like this is not recommended. 
			await fetch(`${url}/account/balance/arweave`, {method: "POST", headers: {'Content-Type': 'application/json'}, body: JSON.stringify({tx_id: tx.id}) })
		
			const res = await fetch(`${url}/tx/arweave`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: di.getRaw() });
			return res;

		} catch (e) {
			console.log(e);
			console.log("ERROR", JSON.stringify(e));
			return new Response("");
		}
	},
};
