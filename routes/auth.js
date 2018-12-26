const express = require('express')
const services = require('./service')
const router = express.Router()

router.post('/:method', services.AuthControl)
module.exports = router
