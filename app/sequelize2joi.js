const _ = require('lodash')
const Joi = require('joi')
const Sequelize = require('sequelize')

const VALID_GEOJSON_TYPES = [
  'Point',
  'Linestring',
  'Polygon',
  'MultiPoint',
  'MultiLineString',
  'MultiPolygon',
  'GeometryCollection',
  'FeatureCollection',
  'Feature'
]

const createGeoJSONValidator = () => {
  let geojsonBasic = Joi.object({
    type: Joi.string()
      .valid(VALID_GEOJSON_TYPES)
      .insensitive(),
    coordinates: Joi.array().sparse(),
    bbox: Joi.array().sparse(),
    properties: Joi.object(),
    crs: Joi.object({
      type: Joi.string()
        .valid('name', 'link')
        .insensitive()
        .required(),
      properties: Joi.object().required()
    })
  })
  //set child keys to original joi object
  geojsonBasic = geojsonBasic.keys({
    geometry: geojsonBasic,
    geometries: Joi.array()
      .items(geojsonBasic)
      .sparse(),
    features: Joi.array()
      .items(geojsonBasic)
      .sparse()
  })
  //add new and improved geojson object to the object again so that the structure is circular
  return geojsonBasic.keys({
    geometry: geojsonBasic,
    geometries: Joi.array()
      .items(geojsonBasic)
      .sparse(),
    features: Joi.array()
      .items(geojsonBasic)
      .sparse()
  })
}

const createNonIntegerValidator = attr => {
  let j = Joi.number()
  if (!attr.type) {
    return j
  }
  if (attr.type._length) {
    let bound = Math.pow(10, attr.type._length)
    j = j.less(bound).greater(-1 * bound)
  }
  if (attr.type._decimals) {
    j = j.precision(attr.type._decimals).strict()
  }
  return j
}

const mapType = (key, attribute) => {
  switch (key) {
    // NUMBER TYPES
    case 'BIGINT':
    case 'INTEGER':
      return Joi.number().integer()

    case 'DECIMAL':
    case 'DOUBLE':
    case 'FLOAT':
    case 'REAL':
      return createNonIntegerValidator(attribute)

    // STRING TYPES
    case 'STRING':
    case 'TEXT':
      return Joi.string().empty('')
    case 'UUID':
      return Joi.string().guid()
    case 'ENUM':
      return Joi.string().allow(attribute.values)

    case 'DATEONLY':
    case 'DATE':
      return Joi.date()

    // OTHER TYPES
    case 'BLOB':
      return Joi.any()
    case 'BOOLEAN':
      return Joi.boolean()
    case 'JSON':
    case 'JSONB':
      return Joi.alternatives().try(Joi.array(), Joi.object())
    case 'ARRAY':
      return Joi.array()
        .sparse()
        .items(mapType(_.get(attribute, 'type.type.key', ''), attribute.type))
    case 'GEOMETRY':
      return createGeoJSONValidator()
    default:
      return Joi.any()
  }
}

const mapValidator = (joi, validator, key) => {
  if (validator === false) {
    return joi
  }

  switch (key) {
    case 'is':
      return joi.regex(validator)
    case 'isEmail':
      return joi.email()
    case 'isUrl':
      return joi.uri()
    case 'isIP':
      return joi.ip()
    case 'isIPv4':
      return joi.ip({ version: ['ipv4'] })
    case 'isIPv6':
      return (joi = joi.ip({ version: ['ipv6'] }))
    case 'min':
      return joi.min(validator)
    case 'max':
      return joi.max(validator)
    case 'notEmpty':
      return joi.min(1)
    default:
      return joi
  }
}

const map = attribute => {
  //allow user to personally set joi objects in models, mainly for JSON/B data types
  if (attribute.sequelizeToJoiOverride) {
    return attribute.sequelizeToJoiOverride
  }

  let joi = mapType(_.get(attribute, 'type.key', ''), attribute)

  // Add model comments to schema description
  if (attribute.comment) {
    joi = joi.description(attribute.comment)
  }

  if (attribute.allowNull === false) {
    joi = joi.required()
  } else {
    joi = joi.allow(null)
  }

  if (
    typeof attribute.defaultValue !== 'undefined' &&
    !_.isObject(attribute.defaultValue) &&
    !_.isFunction(attribute.defaultValue)
  ) {
    joi = joi.optional().default(attribute.defaultValue)
  }

  _.each(attribute.validate, (validator, key) => {
    joi = mapValidator(joi, validator, key)
  })

  return joi
}

const sequelizeToJoi = (model, { omitAssociations = false } = {}) => {
  // Ensure that the model we receive is a Sequelize Model
  if (model.hasOwnProperty('prototype') && !(model.prototype instanceof Sequelize.Model)) {
    throw new TypeError('model is not an instance of Sequelize.Model')
  }

  // The validator for the Sequelize model
  // let joi = Joi.object()

  // Figure out what attributes we are mapping to create the validation schema
  let attributes = model.attributes

  attributes = _.omitBy(attributes, '_timestampAttributes')

  // The keys we parsed out of the model
  let keys = _.mapValues(attributes, map)

  if (!omitAssociations) {
    _.each(model.associations, (reference, name) => {
      // Only go one level deep to avoid circular references
      let schema = sequelizeToJoi(reference.target, { omitAssociations: true })

      if (reference.isSingleAssociation) {
        keys[name] = schema
      } else {
        keys[name] = Joi.array().items(schema)
      }
    })
  }

  // return joi.keys(keys)
  return keys
}

const findAndConvertModels = (object, options) => {
  _.forIn(object, (value, key) => {
    if (value.hasOwnProperty('prototype') && value.prototype instanceof Sequelize.Model) {
      object[key] = sequelizeToJoi(value, options)
    } else if (
      _.isArray(value) &&
      (_.first(value).hasOwnProperty('prototype') &&
        _.first(value).prototype instanceof Sequelize.Model)
    ) {
      object[key] = Joi.array().items(sequelizeToJoi(_.first(value), options))
    } else if (_.isObject(value)) {
      object[key] = findAndConvertModels(value, options)
    }
  })

  return object
}

module.exports = {
  sequelizeToJoi: sequelizeToJoi,
  findAndConvertModels: findAndConvertModels
}
