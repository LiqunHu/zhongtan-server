const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const db = require('./util/db')
const config = require('./config')

const common = require('./util/CommonUtil.js')
const logger = require('./util/Logger').createLogger('model')
const S2J = require('./util/Sequelize2joi')

let files = []

function readDirSync(path) {
  let pa = fs.readdirSync(__dirname + path)
  pa.forEach(function(ele, index) {
    var info = fs.statSync(__dirname + path + '/' + ele)
    if (info.isDirectory()) {
      readDirSync(path + '/' + ele)
    } else {
      if (ele.endsWith('.js')) {
        files.push(path + '/' + ele)
      }
    }
  })
}

readDirSync('/models')

module.exports = {}

for (let f of files) {
  let name = path.basename(f, path.extname(f))
  module.exports[name] = require(__dirname + f)
}

let dbHandle
if (config.RWSeperateFlag) {
  dbHandle = db.sequelizeQuery
} else {
  dbHandle = db.sequelize
}
module.exports.sequelize = db.sequelize

module.exports.simpleSelect = async function(queryStr, replacements) {
  return await dbHandle.query(queryStr, {
    replacements: replacements,
    type: dbHandle.QueryTypes.SELECT
  })
}

// 分页查询函数 pageDoc 有offset limit 两个字段
module.exports.queryWithCount = async function(pageDoc, queryStr, replacements) {
  let cnt = queryStr.indexOf('from') + 5
  let queryStrCnt = queryStr.substr(cnt)

  let count = await dbHandle.query('select count(*) num from ' + queryStrCnt, {
    replacements: replacements,
    type: dbHandle.QueryTypes.SELECT
  })

  let rep = replacements
  rep.push(pageDoc.offset || 0)
  rep.push(pageDoc.limit || 100)

  let queryRst = await dbHandle.query(queryStr + ' LIMIT ?,?', {
    replacements: rep,
    type: dbHandle.QueryTypes.SELECT
  })

  return {
    count: count[0].num,
    data: queryRst
  }
}

module.exports.transaction = function(callback) {
  return new Promise(function(resolve, reject) {
    if (Object.prototype.toString.call(callback) === '[object AsyncFunction]') {
      db.sequelize
        .transaction(function(t) {
          // chain all your queries here. make sure you return them.
          return Promise.all([callback(t)])
        })
        .then(function(result) {
          resolve()
        })
        .catch(function(err) {
          reject(err)
        })
    } else {
      db.sequelize
        .transaction(callback)
        .then(function(result) {
          resolve()
        })
        .catch(function(err) {
          reject(err)
        })
    }
  })
}

module.exports.model2Schema = function() {
  let schema = {}
  for (let a of arguments) {
    schema = _.extend(schema, S2J.sequelizeToJoi(a))
  }
  return schema
}

module.exports.sync = () => {
  return db.sync()
}
