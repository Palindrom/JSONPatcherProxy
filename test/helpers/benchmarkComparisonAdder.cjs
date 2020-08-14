const fs = require('fs');
const { execSync } = require('child_process');

const filePath = './benchmark.tsv';

function getGitCommitHash() {
    return execSync('git rev-parse HEAD').toString().trim();
}

const commitHash = getGitCommitHash().substr(0, 7);
let headerRow = 'Version\tOps/s\tCategory';

function benchmarkComparisonToFile(suite){
    let bench;

    let tsv = [];
    if (fs.existsSync(filePath)) {
        tsv = fs.readFileSync(filePath).toString();
        tsv = tsv.replace(/\r\n/g, '\n');
        tsv = tsv.split('\n');
        if (tsv.length > 0) {
            if (tsv[0] !== headerRow) {
                throw new Error(`File ${filePath} exists but it does not have expected columns in the header. Expected: \n${headerRow}\n Found: \n${tsv[0]}\n`);
            }
        }
    }

    if (tsv.length === 0) {
        tsv.push(headerRow);
    }

    for(let testNo = 0; testNo < suite.length; testNo++){
        bench = suite[testNo];

        if (bench.name.indexOf(' * 1000') > -1) {
            bench.hz = bench.hz/1000;
        }
        else if (bench.name.indexOf(' * 100') > -1) {
            bench.hz = bench.hz/100;
        }
        else if (bench.name.indexOf(' * 10') > -1) {
            bench.hz = bench.hz/10;
        }

        let resultAsFormattedString = bench.hz.toFixed(bench.hz < 100 ? 2 : 0);
        tsv.push(`${commitHash}\t${resultAsFormattedString}\t${bench.name}`);

    }

    fs.writeFileSync(filePath, tsv.join('\n'));
}
if (typeof exports !== "undefined") {
    exports.benchmarkComparisonToFile = benchmarkComparisonToFile;
}