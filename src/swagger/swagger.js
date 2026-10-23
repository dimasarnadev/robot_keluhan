require('dotenv').config();
const path = require('path');

const swaggerJsdoc = require('swagger-jsdoc');

const apiDirectory = path.resolve(__dirname, '../api');

const options = {
    definition: {
        openapi: '3.0.0',

        info: {
            title: 'REST API Gateway v1 - APKT PLN',
            version: '1.0.0',
            description: 'Dokumentasi REST API Gateway v1 APKT PLN'
        },

        servers: [
            {
                url:
                    process.env.PUBLIC_BASE_URL ||
                    `http://localhost:${process.env.PORT || 3000}`,
                description: 'Server'
            }
        ]
    },

    apis: [path.join(apiDirectory, 'docs.js')]
};

const swaggerSpec = swaggerJsdoc(options);

console.log('📚 Swagger paths:', Object.keys(swaggerSpec.paths || {}));

module.exports = swaggerSpec;
