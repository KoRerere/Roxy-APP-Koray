import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { HttpProxyAgent } from "http-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

// node --import=tsx .\scripts\test.mts

const url = `socks5h://rolaiw_1-country-us:rolaiw@gate10.rola.info:2000`;
console.log(`SocksProxyAgent url`, url);
const agent = new SocksProxyAgent(url, {
  timeout: 6000,
});

// const response = await axios.get(
// 	"https://pro.ip-api.com/json?key=c1ulk9X5j8NKqTV",
// 	{
// 		// headers: {
// 		//   Host: new URL(checkChannel).host
// 		// },
// 		timeout: 60000,
// 		httpsAgent: agent,
// 		// httpsAgent: agent,
// 		// proxy: false,
// 	},
// );

const TIMEOUT = 6000;
const checkChannel = `http://iprust.io/ip.json`;
// const httpUrl = `https://cbbang_1:bang@gate5.rola.vip:2657`;
const httpUrl = `http://666us:666@162.250.124.195:8005`;

const response = await axios({
  url: checkChannel,
  timeout: TIMEOUT,
  maxRedirects: 0,
  // proxy: {
  // 	protocol: "https",
  // 	host: "gate5.rola.vip",
  // 	port: 2657,
  // 	auth: { username: "cbbang_1", password: "bang" },
  // },
  httpAgent: new HttpProxyAgent(httpUrl, {
    timeout: 6000,
    rejectUnauthorized: false,
  }),
  // proxy: {
  // 	protocol: "http",
  // 	host: "127.0.0.1",
  // 	port: 7890,
  // 	// auth: {
  // 	// 	username: "8ne71",
  // 	// 	password: "2y9hjsr8",
  // 	// },
  // },
});

console.log(response.data);
