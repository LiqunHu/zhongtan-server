const config = {
  // for sequelize`
  sequelize: {
    dialect: 'mysql',
    database: 'zhongtandata',
    username: 'root',
    password: '123456',
    host: 'localhost',
    port: 33306
  },
  // for redis
  redisCache: true,
  redis: {
    host: 'localhost',
    port: 16379,
    opts: {}
  },
  // for mongo
  mongoFileFlag: true,
  mongo: {
    connect: 'mongodb://127.0.0.1:27017',
    dbName: 'zhongtandata',
    bucketName: 'gridfszhongtan'
  },
  // for elasticsearch
  elasticsearchFlag: false,
  elasticsearch: {
    index: 'zhongtan',
    host: 'localhost:9200',
    log: {
      type: 'file',
      level: 'error',
      path: '../log/elasticsearch.log'
    }
  },
  // for logger
  loggerConfig: {
    level: 'DEBUG',
    config: {
      appenders: {
        out: {
          type: 'stdout'
        },
        everything: {
          type: 'dateFile',
          filename: '../log/app.log',
          pattern: '-yyyy-MM-dd',
          compress: true
        }
      },
      categories: {
        default: {
          appenders: ['out', 'everything'],
          level: 'debug'
        }
      }
    }
  },
  weixin: {
    appid: 'wx1bf0976923162a6b',
    app_secret: 'f03e63ca1aca1c007b5915b54b6ec8c7'
  },
  syslogFlag: true,
  uploadOptions: {
    autoFields: true,
    autoFiles: true,
    uploadDir: '../public/temp',
    maxFileSize: 2 * 1024 * 1024
  },
  tempDir: '../public/temp',
  filesDir: '../public/files',
  tmpUrlBase: '/temp/',
  fileUrlBase: '/files/',
  fsUrlBase: '/filesys/',
  // SECRET_KEY
  SECRET_KEY: 'zc7#_66#g%u2n$j_)j$-r(swt63d(2l%wc2y=wqt_m8kpy%05*',
  TOKEN_AGE: 43200000, // 12 * 60 * 60 * 10000
  MOBILE_TOKEN_AGE: 31536000000 // 365 * 24 * 60 * 60 * 1000
};

module.exports = config;