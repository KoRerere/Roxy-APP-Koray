import { parseArgs } from "node:util";

console.log(process.argv);
const options = {
	foo: {
		type: "boolean" as const,
		short: "f",
	},
	bar: {
		type: "string" as const,
	},
};

const { values, positionals } = parseArgs({
	args: process.argv.slice(2),
	options,
	strict: false,
});

console.log(values, positionals);
// Prints: [Object: null prototype] { foo: true, bar: 'b' } []
