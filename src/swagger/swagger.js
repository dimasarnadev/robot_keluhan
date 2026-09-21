const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const apiDirectory = path.resolve(
    __dirname,
    '../api'
);

console.log(
    '📂 API directory:',
    apiDirectory
);

const options = {

    definition: {

        openapi: '3.0.0',

        info: {
            title: 'REST API Gateway v1 - APKT PLN',
            version: '1.0.0',

            description:
                'Dokumentasi REST API Gateway v1 APKT PLN'
        },

        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Localhost'
            }
        ]

    },

    apis: [
        path.join(apiDirectory, 'docs.js'),
        // path.join(apiDirectory, '*.js')
    ]

};

const swaggerSpec =
    swaggerJsdoc(options);

console.log(
    '📚 Swagger paths:',
    Object.keys(
        swaggerSpec.paths || {}
    )
);

module.exports =
    swaggerSpec;