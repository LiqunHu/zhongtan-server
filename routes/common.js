const express = require('express')
const services = require('./service')
const router = express.Router()

// system
router.post('/system/SystemApiControl/:method', services.SystemApiControl)
router.post('/system/GroupControl/:method', services.GroupControl)
router.post('/system/OperatorControl/:method', services.OperatorControl)
router.post('/system/UserSetting/:method', services.UserSettingControl)
module.exports = router
