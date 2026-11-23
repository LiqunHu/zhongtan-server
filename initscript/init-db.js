const model = require('../app/model.js')
const db = require('../app/db.js')

// 危险操作提示：model.sync() 在非 production 环境会执行 sequelize.sync({ alter: true })，
// 即按 models/ 里的定义去 ALTER 已存在的表结构（加列、改列类型、改长度），
// 不区分这个库里有没有真实业务数据。曾发生过手工改过的列类型被 sync 改回模型定义的情况。
//
// 所以这里要求显式确认才执行，避免误连到已有数据的库：
//   INIT_DB_CONFIRM=yes node initscript/init-db.js
if (String(process.env.INIT_DB_CONFIRM).toLowerCase() !== 'yes') {
  const c = db.sequelize.config || {}
  console.error('')
  console.error('已阻止执行：init-db.js 会按模型定义 ALTER 现有的表结构。')
  console.error('  目标数据库 : ' + (c.host || '?') + ':' + (c.port || '?') + '/' + (c.database || '?'))
  console.error('  NODE_ENV   : ' + (process.env.NODE_ENV || '(未设置)'))
  console.error('  执行动作   : sequelize.sync({ alter: true }) —— 按模型定义修改已存在的列')
  console.error('')
  console.error('确认这是空库 / 可以接受结构被覆盖，再执行：')
  console.error('  INIT_DB_CONFIRM=yes node initscript/init-db.js')
  console.error('')
  process.exit(1)
}

model
  .sync()
  .then(() => {
    console.log('Init database OK!')
    process.exit(0)
  })
  .catch(e => {
    console.log(e)
    process.exit(0)
  })
