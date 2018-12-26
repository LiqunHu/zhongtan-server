const serverUtils = require('server-utils')
// 设置logger
serverUtils.setLogger(require('./logger'))

const config = require('./config')
const rpcrouter = require('../RPCRoutes')
// 计划任务
const schedule = require('../schedule')
const scheduleJob = serverUtils.scheduleJob
// RPC Websocket 连接池
const websocketUtil = serverUtils.websocketUtil
// rabbitmq
const rabbitmqClinet = serverUtils.rabbitmqClinet

const init = () => {
  // for schedule job
  scheduleJob.initSchedule(config, schedule)

  // RPC Websocket 连接池
  websocketUtil.genConnectionPools(config.wsservers)

  // RPC Websocket 连接池
  rabbitmqClinet.initRabbitmqClient(config.rabbitmq, rpcrouter)
}

module.exports = {
    init: init
}
