import ejs from "ejs";
import { writeFile } from "fs/promises";
import { join } from "path";

ejs.renderFile(join(__dirname, '../../web/public/blockDomain.ejs'), { baseUrl: "http://127.0.0.1:45535" }, (err, str) => {
  console.log(str);
  writeFile(join(__dirname, 'blockDomain.html'), str)
})
