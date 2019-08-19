const chalk = require('chalk');
const fs = require('fs');

function benchmarkComparisonToConsole() {
    console.log("\n");
    console.log("==================");
    console.log("Benchmark comparison:");
    console.log("------------------");

    const filePath = './benchmark.tsv';
    let tsv = [];
    if (fs.existsSync(filePath)) {
        tsv = fs.readFileSync(filePath).toString();
        tsv = tsv.replace(/\r\n/g, '\n');
        tsv = tsv.split('\n');
    }

    if (tsv.length < 2) {
        throw new Error(`File ${filePath} does not contain TSV data`);
    }

    tsv.shift(); // remove header

    const groups = new Map();

    tsv.forEach(row => {
        const [hash, ops, suiteName] = row.split('\t');
        if (!groups.has(suiteName)) {
            groups.set(suiteName, []);
        }

        const group = groups.get(suiteName);
        group.push({
            hash,
            ops
        });
    });

    groups.forEach((group, suiteName) => {
        console.log(chalk.yellow.underline(suiteName));
        let first;
        group.forEach(row => {
            if (first === undefined) {
                first = row;
                console.log(` ${row.hash}: ${chalk.magenta(row.ops)} Ops/sec`);
            }
            else {
                const relative = (((row.ops / first.ops) * 100) - 100).toFixed(1);
                let relativeString;
                if (relative > 0) {
                    relativeString = chalk.bold.green(`${relative}% better`);
                }
                else if (relative < 0) {
                    relativeString = chalk.bold.red(`${-relative}% worse`);
                }
                else {
                    relativeString = chalk.gray(`no difference`);
                }
                console.log(` ${row.hash}: ${chalk.magenta(row.ops)} Ops/sec (${relativeString})`);
            }
        })
    });

    console.log("===================");
    console.log(chalk.gray("Run `npm run bench` at another Git commit to create a comparison"));

}
if (typeof exports !== "undefined") {
    exports.benchmarkComparisonToConsole = benchmarkComparisonToConsole;
}