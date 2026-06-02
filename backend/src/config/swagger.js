import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CollabAI API',
      version: '1.0.0',
      description: 'CollabAI Collaborative Intelligence API'
    },
    servers: [
      {
        url: process.env.BASE_URL || 'http://localhost:8080',
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js'], // your route files
}

export const swaggerSpec = swaggerJsdoc(options)