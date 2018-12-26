const fs = require('fs')
const path = require('path')

const files = []

function readDirSync(dir) {
  let pa = fs.readdirSync(path.join(__dirname, dir))
  pa.forEach(function(ele) {
    let info = fs.statSync(path.join(__dirname, dir, ele))
    if (info.isDirectory()) {
      readDirSync(path.join(dir, ele))
    } else {
      if (ele.endsWith('Control.js')) {
        files.push(path.join(dir, ele))
      }
    }
  })
}

readDirSync('../services')

module.exports = {}

for (let f of files) {
  // logger.debug(`import service from file ${f}...`);
  let name = path.basename(f, path.extname(f))
  module.exports[name] = require(path.join(__dirname, f))
}
