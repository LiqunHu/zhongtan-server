const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const db = require('./db')
const config = require('./config')

const S2J = require('./sequelize2joi')

const files = []

const readDirSync = dir => {
  let pa = fs.readdirSync(path.join(__dirname, dir))
  pa.forEach(ele => {
    let info = fs.statSync(path.join(__dirname, dir, ele))
    if (info.isDirectory()) {
      readDirSync(path.join(dir, ele))
    } else {
      if (ele.endsWith('.js')) {
        files.push(path.join(dir, ele))
      }
    }
  })
}

readDirSync('../models')

module.exports = {}

for (let f of files) {
  let name = path.basename(f, path.extname(f))
  module.exports[name] = require(path.join(__dirname, f))
}

let dbHandle
if (config.RWSeperateFlag) {
  dbHandle = db.sequelizeQuery
} else {
  dbHandle = db.sequelize
}
module.exports.sequelize = db.sequelize

module.exports.simpleSelect = async (queryStr, replacements) => {
  return await dbHandle.query(queryStr, {
    replacements: replacements,
    type: dbHandle.QueryTypes.SELECT
  })
}

// 分页查询函数 pageDoc 有offset limit 两个字段
module.exports.queryWithCount = async (pageDoc, queryStr, replacements) => {
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

module.exports.transaction = callback => {
  return new Promise((resolve, reject) => {
    if (Object.prototype.toString.call(callback) === '[object AsyncFunction]') {
      db.sequelize
        .transaction(t => {
          // chain all your queries here. make sure you return them.
          return Promise.all([callback(t)])
        })
        .then(() => {
          resolve()
        })
        .catch(err => {
          reject(err)
        })
    } else {
      db.sequelize
        .transaction(callback)
        .then(() => {
          resolve()
        })
        .catch(err => {
          reject(err)
        })
    }
  })
}

module.exports.model2Schema = (...args) => {
  let schema = {}
  for (let a of args) {
    schema = _.extend(schema, S2J.sequelizeToJoi(a))
  }
  return schema
}

module.exports.sync = () => {
  return db.sync()
}

module.exports.Op = db.Op
