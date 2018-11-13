const express = require('express')
const services = require('./service')
const router = express.Router()

//common
//commonQuery
router.post('/components/userSelectDialogControl/:method', services.UserSelectDialogSRV.UserSelectDialogResource)
router.post('/components/DomainSelectDialogControl/:method', services.DomainSelectDialogSRV.DomainSelectDialogResource)

// baseconfig
router.post('/baseconfig/FollowerControl/:method', services.FollowerControlSRV.FollowerControlResource)

// system
router.post('/system/SystemApiControl/:method', services.SystemApiControlSRV.SystemApiControlResource)
router.post('/system/DomainTemplateControl/:method', services.DomainTemplateControlSRV.DomainTemplateControlResource)
router.post('/system/DomainControl/:method', services.DomainControlSRV.DomainControlResource)
router.post('/system/DomainGroupControl/:method', services.DomainGroupControlSRV.DomainGroupControlResource)
router.post('/system/DomainGroupApiControl/:method', services.DomainGroupApiControlSRV.DomainGroupApiControlResource)
router.post('/system/OperatorControl/:method', services.OperatorControlSRV.OperatorControlResource)
router.post('/system/UserSetting/:method', services.UserSettingSRV.UserSettingResource)
router.post('/system/ResetPassword/:method', services.UserResetPasswordSRV.UserResetPasswordResource)

module.exports = router
