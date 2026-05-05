const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/saferoute', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(`[MongoDB] Conectado: ${conn.connection.host}`);
    } catch (err) {
        console.error(`[Error] Fallo al conectar a MongoDB: ${err.message}`);
        // No cerrar el proceso para permitir depuración, pero la API fallará en peticiones DB
    }
};

module.exports = connectDB;
