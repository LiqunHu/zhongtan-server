const _ = require('lodash')
const Sequelize = require('sequelize')
const mongoClient = require('server-utils').mongoClient
const elasticsearchClient = require('server-utils').elasticsearchClient

const config = require('./config')
const logger = require('./logger').createLogger(__filename)

logger.debug('init sequelize...')

let sequelize = new Sequelize(config.mysql.normal.database, config.mysql.normal.username, config.mysql.normal.password, {
  host: config.mysql.normal.host,
  port: config.mysql.normal.port,
  dialect: 'mysql',
  timezone: '+03:00', //东三时区
  pool: {
    max: 20, // max
    min: 0, // min
    acquire: 30000,
    idle: 10000 //10 seconds
  },
  retry: {
    match: 'getaddrinfo ENOTFOUND',
    max: 3
  },
  logging: function(sql) {
    logger.debug(sql)
  }
})

const defineModel = (name, attributes, params) => {
  let attrs = {}
  let tbpara = arguments[2] ? params : {}

  for (let key in attributes) {
    let value = attributes[key]
    if (typeof value === 'object' && value['type']) {
      value.allowNull = value.allowNull || false
      attrs[key] = value
    } else {
      attrs[key] = {
        type: value,
        allowNull: false
      }
    }
  }

  attrs.state = {
    type: Sequelize.STRING(5),
    defaultValue: '1'
  }

  attrs.version = {
    type: Sequelize.BIGINT,
    defaultValue: 0,
    allowNull: false
  }
  // console.log('model defined for table: ' + name + '\n' + JSON.stringify(attrs, function(k, v) {
  //     if (k === 'type') {
  //         for (let key in Sequelize) {
  //             if (key === 'ABSTRACT' || key === 'NUMBER') {
  //                 continue;
  //             }
  //             let dbType = Sequelize[key];
  //             if (typeof dbType === 'function') {
  //                 if (v instanceof dbType) {
  //                     if (v._length) {
  //                         return `${dbType.key}(${v._length})`;
  //                     }
  //                     return dbType.key;
  //                 }
  //                 if (v === dbType) {
  //                     return dbType.key;
  //                 }
  //             }
  //         }
  //     }
  //     return v;
  // }, '  '));
  return sequelize.define(
    name,
    attrs,
    Object.assign(
      {
        tableName: name,
        timestamps: true,
        underscored: true,
        hooks: {
          beforeValidate: obj => {
            if (obj.isNewRecord) {
              logger.debug('will create entity...' + obj)
              obj.version = 0
            } else {
              logger.debug('will update entity...')
              obj.version++
            }
          },
          afterCreate: async obj => {
            try {
              let jsonObj = JSON.parse(JSON.stringify(obj))
              if (obj.constructor.tableName === 'tbl_common_user') {
                delete jsonObj.password
              }
              let elk = elasticsearchClient.getClient()
              if (!_.isNull(elk)) {
                elk
                  .create({
                    index: config.elasticsearch.index + '-' + obj.constructor.tableName,
                    type: 'table',
                    id: obj[obj.constructor.primaryKeyField],
                    body: jsonObj
                  })
                  .then(
                    function() {},
                    function(err) {
                      logger.error(err)
                    }
                  )
              }

              if (config.mongoSyncFlag) {
                let db = mongoClient.getDb()
                let collection = db.collection(obj.constructor.tableName)
                await collection.insertOne(jsonObj)
              }
            } catch (error) {
              logger.error(error)
            }
          },
          afterUpdate: async obj => {
            try {
              let jsonObj = JSON.parse(JSON.stringify(obj))
              if (obj.constructor.tableName === 'tbl_common_user') {
                delete jsonObj.password
              }
              let elk = elasticsearchClient.getClient()
              if (!_.isNull(elk)) {
                elk
                  .index({
                    index: config.elasticsearch.index + '-' + obj.constructor.tableName,
                    type: 'table',
                    id: obj[obj.constructor.primaryKeyField],
                    body: jsonObj
                  })
                  .then(
                    function() {},
                    function(err) {
                      logger.error(err)
                    }
                  )
              }

              if (config.mongoSyncFlag) {
                let db = mongoClient.getDb()
                let collection = db.collection(obj.constructor.tableName)
                let key = obj.constructor.primaryKeyField
                let queryCondition = {}
                queryCondition[key] = obj[key]

                await collection.updateOne(queryCondition, { $set: jsonObj })
              }
            } catch (error) {
              logger.error(error)
            }
          }
        }
      },
      tbpara
    )
  )
}

const TYPES = ['STRING', 'INTEGER', 'BIGINT', 'TEXT', 'DOUBLE', 'DATEONLY', 'DATE', 'BOOLEAN', 'UUID', 'UUIDV1', 'JSON']

let exp = {
  ID: Sequelize.STRING(30),
  IDNO: Sequelize.BIGINT,
  sequelize: sequelize,
  Op: Sequelize.Op,
  literal: Sequelize.literal,
  defineModel: defineModel,
  sync: () => {
    // only allow create ddl in non-production environment:
    if (process.env.NODE_ENV !== 'production') {
      return sequelize.sync({
        alter: true
      })
    } else {
      throw new Error("Cannot sync() when NODE_ENV is set to 'production'.")
    }
  }
}

for (let type of TYPES) {
  exp[type] = Sequelize[type]
}

if (!_.isEmpty(config.mysql.readonly)) {
  let sequelizeQuery = new Sequelize(config.mysql.readonly.database, config.mysql.readonly.username, config.mysql.readonly.password, {
    host: config.mysql.readonly.host,
    port: config.mysql.readonly.port,
    dialect: 'mysql',
    timezone: '+08:00', //东八时区
    pool: {
      max: 20, // max
      min: 0, // min
      acquire: 30000,
      idle: 10000 //10 seconds
    },
    retry: {
      match: 'getaddrinfo ENOTFOUND',
      max: 3
    },
    logging: function(sql) {
      logger.debug(sql)
    }
  })
  exp.sequelizeQuery = sequelizeQuery
}

module.exports = exp
