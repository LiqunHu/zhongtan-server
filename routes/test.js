const express = require('express')
const services = require('./service')
const router = express.Router()

router.post('/test/:method', services.TestControl)
module.exports = router
