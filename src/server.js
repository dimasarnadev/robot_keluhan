require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const swaggerUi =
    require('swagger-ui-express');

const {
    db
} = require('./config/database');

const {
    session,
    loadSessionFromDB
} = require('./config/session');

const authRoutes =
    require('./api/auth');

const masterRoutes =
    require('./api/master');

const keluhanRoutes =
    require('./api/keluhan');

const whatsappRoutes =
    require('./api/whatsapp');

const swaggerSpec =
    require('./swagger/swagger');

const {
    startKeluhanPoller
} = require('./jobs/keluhan-poller');


const app = express();

const PORT =
    process.env.PORT || 3002;


app.use(cors());

app.use(
    express.json()
);


loadSessionFromDB();


app.use(
    '/api/v1/auth',
    authRoutes({
        db,
        session
    })
);


app.use(
    '/api/v1/master',
    masterRoutes({
        db,
        session
    })
);


app.use(
    '/api/v1',
    keluhanRoutes({
        db,
        session
    })
);


app.use(
    '/api/v1/whatsapp',
    whatsappRoutes({
        db,
        session
    })
);


app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(
        swaggerSpec
    )
);


app.get(
    '/api-docs.json',
    (req, res) => {
        res.json(swaggerSpec);
    }
);


app.listen(
    PORT,
    () => {

        console.log(
            `🚀 REST API running on port ${PORT}`
        );

        console.log(
            `📚 Swagger: http://localhost:${PORT}/api-docs`
        );

        console.log(
            `📱 WAHA webhook: ` +
            `http://localhost:${PORT}/api/v1/whatsapp/webhook`
        );

        startKeluhanPoller();
    }
);