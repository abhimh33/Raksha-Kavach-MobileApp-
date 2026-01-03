const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect('mongodb://127.0.0.1:27017/rakshakavach');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        console.log('\n⚠️  MongoDB is not running. The app will work without a database,');
        console.log('   but location history and geofences will not be persisted.');
        console.log('\n   To start MongoDB:');
        console.log('   • Windows: Start MongoDB service from Services or run mongod');
        console.log('   • Or use MongoDB Atlas cloud: update connection string above\n');
    }
};

module.exports = connectDB;

