const db = require('../../app/db')
// 客户黑名单操作记录（锁定 / 解锁 审计日志）

module.exports = db.defineModel('tbl_zhongtan_customer_blacklist_log', {
  blacklist_log_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  // 客户
  blacklist_customer_id: {
    type: db.STRING(36),
    allowNull: false
  },
  blacklist_customer_name: {
    type: db.STRING(200),
    allowNull: true
  },
  // LOCK 锁定 / UNLOCK 解锁
  blacklist_action: {
    type: db.STRING(10),
    allowNull: false
  },
  // AUTO 系统自动 / MANUAL 人工操作
  blacklist_source: {
    type: db.STRING(10),
    allowNull: false
  },
  // 原因代码：INVOICE_1~5 超期费规则、MNR_1 修箱费、UNUSUAL_1 异常票、MANUAL 人工
  blacklist_reason_code: {
    type: db.STRING(50),
    allowNull: true
  },
  // 规则分布名称（规则①/②、修箱费、异常票、自动解除、人工操作），便于核对命中口径
  blacklist_rule_name: {
    type: db.STRING(100),
    allowNull: true
  },
  // 原因描述（自动判定生成的可读说明，或人工填写的备注）
  blacklist_reason_text: {
    type: db.STRING(500),
    allowNull: true
  },
  // 关联单据：收据号 / 修箱费发票号 / 异常票号
  blacklist_order_no: {
    type: db.STRING(100),
    allowNull: true
  },
  // 关联提单号
  blacklist_bl_no: {
    type: db.STRING(50),
    allowNull: true
  },
  // 关联箱号
  blacklist_container_no: {
    type: db.STRING(50),
    allowNull: true
  },
  blacklist_container_id: {
    type: db.BIGINT,
    allowNull: true
  },
  // 涉及金额：应缴 / 已收 / 未付
  blacklist_due_amount: {
    type: db.STRING(50),
    allowNull: true
  },
  blacklist_paid_amount: {
    type: db.STRING(50),
    allowNull: true
  },
  blacklist_unpaid_amount: {
    type: db.STRING(50),
    allowNull: true
  },
  // 操作前后状态
  blacklist_before_status: {
    type: db.STRING(5),
    allowNull: true
  },
  blacklist_after_status: {
    type: db.STRING(5),
    allowNull: true
  },
  // 操作人（人工操作为登录用户，系统自动为 SYSTEM）
  blacklist_operator_id: {
    type: db.STRING(36),
    allowNull: true
  },
  blacklist_operator_name: {
    type: db.STRING(100),
    allowNull: true
  }
})
