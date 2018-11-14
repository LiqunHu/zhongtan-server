const model = require('./model.js')

// change saleoutitemorder to your table
const tb_table = model.zhongtan_uploadfile

if (process.env.NODE_ENV !== 'production') {
  tb_table
    .sync({
      force: true
    })
    .then(result => {
      console.info('success')
      process.exit(0)
    })
} else {
  console.log("Cannot sync() when NODE_ENV is set to 'production'.")
}
