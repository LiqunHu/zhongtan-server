const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_finance_ought_receive', {
  ought_receive_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  ought_receive_receipt_file_id: {
    // 收据文件
    type: db.STRING(50),
    allowNull: false
  },
  ought_receive_no: {
    // 收据号
    type: db.STRING(50),
    allowNull: false
  },
  ought_receive_type: {
    // 收据类型
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_amount: {
    // 收据金额
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_natamount: {
    // 本币金额
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_original_amount: {
    // 原币金额
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_currency: {
    // 币种
    type: db.STRING(10),
    allowNull: false
  },
  ought_receive_bank: {
    // 银行
    type: db.STRING(20),
    allowNull: true
  },
  ought_receive_reference_no: {
    // 银行号
    type: db.STRING(50),
    allowNull: true
  },
  ought_receive_object_id: {
    // 关联单id
    type: db.STRING(50),
    allowNull: false
  },
  ought_receive_object: {
    // 关联提单号
    type: db.STRING(50),
    allowNull: false
  },
  ought_receive_carrier: {
    // 关联提单号代理
    type: db.STRING(20),
    allowNull: true
  },
  ought_receive_from_id: {
    // 应收id
    type: db.STRING(50),
    allowNull: false
  },
  ought_receive_from: {
    // 应收名称
    type: db.STRING(50),
    allowNull: false
  },
  ought_receive_from_u8_code: {
    // 应收u8编码
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_from_u8_alias: {
    // 应收u8简称
    type: db.STRING(50),
    allowNull: false
  },
  ought_receive_operator_id: {
    // 操作员id
    type: db.STRING(50),
    allowNull: false
  },
  ought_receive_operator_name: {
    // 操作员名称
    type: db.STRING(50),
    allowNull: false
  },
  ought_receive_digest: {
    // 描述
    type: db.STRING(50),
    allowNull: true
  },
  ought_receive_u8_id: {
    // 新增成功后返回新单据编号
    type: db.STRING(50),
    allowNull: true
  },
  ought_receive_u8_trade_id: {
    // 新增成功后返回交易唯一识别码
    type: db.STRING(50),
    allowNull: true
  },
  received_no: {
    // 付款单编号
    type: db.STRING(50),
    allowNull: true
  },
  accept_u8_id: {
    // 付款单U8id
    type: db.STRING(50),
    allowNull: true
  },
  accept_trade_id: {
    // 付款单U8交易唯一识别码
    type: db.STRING(50),
    allowNull: true
  },
  ought_receive_u8_biz_id: {
    // 应收单U8 业务ID
    type: db.STRING(50),
    allowNull: true
  },
  accept_u8_biz_id: {
    // 付款单U8  业务ID
    type: db.STRING(50),
    allowNull: true
  },
  ought_receive_subject_code: {
    // 应收单表头科目
    type: db.STRING(50),
    allowNull: true
  },
  ought_accept_subject_code: {
    // 收款单表头科目
    type: db.STRING(50),
    allowNull: true
  },
  ought_receive_balance_code: {
    // 结算方式
    type: db.STRING(20),
    allowNull: true
  },
  ought_receive_currency_rate: {
    // 汇率
    type: db.STRING(20),
    allowNull: true
  },
  ought_received_digest: {
    // 收款单摘要
    type: db.STRING(50),
    allowNull: true
  },
  accept_at: {
    // 收款单时间
    type: db.DATE,
    allowNull: true
  },
  accept_operator_id: {
    // 收款单操作员
    type: db.STRING(50),
    allowNull: true
  },
  ought_received_split: {
    // 收款单操作员
    type: db.STRING(5),
    allowNull: false,
    defaultValue: '0'
  },
})
