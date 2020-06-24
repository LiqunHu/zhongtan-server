const config = {
  mysql: {
    normal: {
      database: 'zhongtandata',
      username: 'root',
      password: '123456',
      host: 'localhost',
      port: 33306
    },
    readonly: {}
  },
  // for redis
  redis: {
    host: 'localhost',
    port: 16379,
    opts: {},
    redisKey: {
      AUTH: 'AUTH',
      SMS: 'SMS',
      CAPTCHA: 'CAP'
    }
  },
  // for mongo
  mongoSyncFlag: false,
  mongo: {
    url: 'mongodb://127.0.0.1:27017',
    options: {},
    dbName: 'zhongtandata'
  },
  // for elasticsearch
  elasticsearch: {
    // index: 'zhongtan',
    // host: '127.0.0.1:9200',
    // log: {
    //   type: 'file',
    //   level: 'error',
    //   path: '../log/elasticsearch.log'
    // }
  },
  // for rabbitmqClinet
  // rabbitmq: {
  //   connectOptions: {
  //     protocol: 'amqp',
  //     hostname: 'localhost',
  //     port: 5672
  //   },
  //   publisherQueue: {
  //     config: {
  //       max: 2, // maximum size of the pool
  //       min: 1 // minimum size of the pool
  //     },
  //     queues: ['test']
  //   },
  //   consumerQueue: ['test']
  // },
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
  wsservers: {
    // pooltest: {
    //   host: '127.0.0.1',
    //   port: 9090,
    //   config: {
    //     max: 10, // maximum size of the pool
    //     min: 3 // minimum size of the pool
    //   },
    //   desc: '内部连接池测试'
    // }
  },
  // schedule job
  scheduleJobs: [{name: 'readEdiMail', rule: '0 0/5 * * * ?'}, {name: 'resetDemurrageReceiptSeq', rule: '0 0 0 1 * ?'}],
  // sms: {
  //   appid: '26763',
  //   appkey: '0d7e27433af7744451809fb2136ae834',
  //   signtype: 'normal' /*可选参数normal,md5,sha1*/
  // },
  // qiniu: {
  //   accessKey: 'n7O-3elJh6lKYOaAywJ5MlmwvGxa6MgMPf1vLAmB',
  //   secretKey: 'ntcyQ9co6mMJTN-raHVbz8FabnLMxuLORmXMG7Qq'
  // },
  // weixin: {
  //   // 小程序授权相关
  //   appid: 'wx1bf0976923162a6b',
  //   app_secret: 'f03e63ca1aca1c007b5915b54b6ec8c7'
  // },
  fileSys: {
    type: 'mongo' /* 可选 local qiniu mongo*/,
    filesDir: '../public/temp/' /* 本地目录对于非本地存储是临时文件目录 */,
    tempUrl: '/temp/',
    bucket: {
      zhongtan: {
        baseUrl: '/filesys/zhongtan/'
      }
    }
  },
  mailConfig: {
    sender: 'system@sinotaship.com',
    host: 'smtp.263.net',
    // port: 587,
    secure: true, // true for 465, false for other ports
    auth: {
      user: 'system@sinotaship.com', // generated ethereal user
      pass: 'kKqkZutAK2b0B6jX' // generated ethereal password
    }
  },
  sysEdiMailConfig: {
    user: 'edi@sinotaship.com',
    password: 'SHIPping@20200401',
    host: 'imap.263.net',
    port: 993,
    tls: true
  },
  // SECRET_KEY
  SECRET_KEY: 'zc7#_66#g%u2n$j_)j$-r(swt74d(2l%wc2y=wqt_m8kpy%04*',
  TOKEN_AGE: 43200000, // 12 * 60 * 60 * 10000
  MOBILE_TOKEN_AGE: 31536000000, // 365 * 24 * 60 * 60 * 1000
  SMS_TOKEN_AGE: 300000, // 5* 60 * 1000
  CAPTCHA_TOKEN_AGE: 60000 // 60 * 1000
}

module.exports = config
